import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import sharp from "sharp";
import db from "@/lib/db";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Rota cara: cada POST chama a API da Anthropic e consome credito do dono.
// 10 req/min por IP contem abuso sem incomodar o uso pessoal normal.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// Teto por imagem: ~8MB de texto de data URL (prefixo + base64). Base64 infla
// ~33% sobre os bytes originais, entao isso equivale a ~6MB de imagem decodificada -
// confortavel para uma foto de celular e barato de rejeitar antes do sharp/Anthropic.
const MAX_IMAGE_DATA_URL_CHARS = 8 * 1024 * 1024;

// Teto do total das ate 5 imagens somadas: ~20MB de data URL (~15MB decodificado).
// Evita contornar o teto por imagem mandando varias imagens proximas do limite individual.
const MAX_TOTAL_DATA_URL_CHARS = 20 * 1024 * 1024;

const BodySchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(5),
});

// Formato que a IA deve devolver, imposto via structured outputs. Ficam so
// tipos simples: restricoes numericas (minimo etc.) nao sao garantidas pelo
// schema da API, entao a sanidade dos valores e checada depois, no codigo.
const AnalysisSchema = z.object({
  food_name: z.string().describe("Nome curto do prato"),
  calories: z.number().describe("Calorias totais da refeicao (kcal)"),
  macros: z.object({
    protein: z.number().describe("Proteinas em gramas"),
    carbs: z.number().describe("Carboidratos em gramas"),
    fat: z.number().describe("Gorduras em gramas"),
    fiber: z.number().describe("Fibras em gramas"),
  }),
  confidence: z.enum(["high", "medium", "low"]),
  explanation: z.string().describe("Frase curta, no maximo 20 palavras"),
});

type Analysis = z.infer<typeof AnalysisSchema>;

function hasSaneValues(a: Analysis): boolean {
  const values = [a.calories, a.macros.protein, a.macros.carbs, a.macros.fat, a.macros.fiber];
  return a.food_name.trim().length > 0 && values.every((v) => Number.isFinite(v) && v >= 0);
}

async function resizeToThumbnail(base64: string): Promise<string> {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const resized = await sharp(buffer)
    .resize(200, 200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
  return "data:image/jpeg;base64," + resized.toString("base64");
}

function extractBase64(dataUrl: string): { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image format");
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  return { data: match[2], mediaType };
}

export async function POST(req: Request) {
  // Rate limit antes de qualquer trabalho caro: antes de ler o corpo, antes
  // do sharp, antes da chamada a Anthropic.
  const rl = rateLimit(`analyze:${clientKey(req)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: "Muitas requisicoes. Tente novamente mais tarde." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSeconds),
        },
      }
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response("Imagem nao fornecida", { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response("Imagem nao fornecida", { status: 400 });
    }

    const { images } = parsed.data;

    // Teto de bytes antes de decodificar/redimensionar ou chamar a Anthropic:
    // rejeicao barata (so compara o tamanho das strings).
    if (images.some((img) => img.length > MAX_IMAGE_DATA_URL_CHARS)) {
      return new Response("Imagem muito grande", { status: 400 });
    }
    const totalChars = images.reduce((sum, img) => sum + img.length, 0);
    if (totalChars > MAX_TOTAL_DATA_URL_CHARS) {
      return new Response("Imagens excedem o tamanho total permitido", { status: 400 });
    }

    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    const imageContent = images.map((img) => {
      const { data, mediaType } = extractBase64(img);
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data },
      };
    });

    // Structured outputs em vez de pedir JSON no prompt e extrair com regex.
    // Nao usar tool_choice forcado: ele retorna 400 em modelos mais novos
    // (Opus 5.5, Sonnet 5.5), e o modelo e trocavel via ANTHROPIC_MODEL.
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: "Voce e um nutricionista experiente. Analise as imagens da comida fornecidas com precisao.",
      output_config: { format: zodOutputFormat(AnalysisSchema) },
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `Analise esta refeicao (${images.length} foto${images.length > 1 ? "s" : ""}) e estime calorias e macronutrientes da porcao mostrada.`,
            },
          ],
        },
      ],
    });

    // parsed_output e null em recusa ou resposta cortada por max_tokens.
    const analysis = response.parsed_output;
    if (!analysis || !hasSaneValues(analysis)) {
      console.error("Resposta da IA invalida:", response.stop_reason, JSON.stringify(response.content));
      return new Response("A IA nao retornou uma analise valida. Tente outra foto.", { status: 502 });
    }

    const thumbnail = await resizeToThumbnail(images[0]);
    const { error: insertError } = await db.from("meals").insert({
      food_name: analysis.food_name,
      calories: analysis.calories,
      protein: analysis.macros.protein,
      carbs: analysis.macros.carbs,
      fat: analysis.macros.fat,
      fiber: analysis.macros.fiber,
      confidence: analysis.confidence,
      explanation: analysis.explanation,
      image_base64: thumbnail
    });
    if (insertError) console.error("Erro ao salvar refeicao:", insertError.message);

    return Response.json(analysis);
  } catch (error) {
    console.error("Erro na analise:", error);
    return new Response("Erro ao processar imagem", { status: 500 });
  }
}
