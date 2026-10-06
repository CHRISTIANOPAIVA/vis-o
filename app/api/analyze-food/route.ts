import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import sharp from "sharp";
import db from "@/lib/db";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BodySchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(5),
});

const AnalysisSchema = z.object({
  food_name: z.string().describe("nome curto do prato"),
  calories: z.number().describe("calorias totais (kcal)"),
  macros: z.object({
    protein: z.number().describe("gramas"),
    carbs: z.number().describe("gramas"),
    fat: z.number().describe("gramas"),
    fiber: z.number().describe("gramas"),
  }),
  confidence: z.enum(["high", "medium", "low"]),
  explanation: z.string().describe("frase curta, max 20 palavras"),
});

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
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response("Imagem nao fornecida", { status: 400 });
    }

    const { images } = parsed.data;
    const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

    const imageContent = images.map((img) => {
      const { data, mediaType } = extractBase64(img);
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data },
      };
    });

    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      // Thinking is always on for this model; effort controls how much it thinks.
      output_config: { effort: "low", format: betaZodOutputFormat(AnalysisSchema) },
      // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: "Voce e um nutricionista experiente. Analise as imagens da comida fornecidas com precisao.",
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `Analise esta refeicao (${images.length} foto${images.length > 1 ? "s" : ""}) e estime o prato, as calorias totais e os macronutrientes.`
            }
          ]
        }
      ]
    });

    if (response.stop_reason === "refusal") {
      throw new Error("Analysis refused: " + (response.stop_details?.category ?? "unknown"));
    }
    const analysis = response.parsed_output;
    if (!analysis) throw new Error("No structured output (stop_reason: " + response.stop_reason + ")");

    const thumbnail = await resizeToThumbnail(images[0]);
    await db.from("meals").insert({
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

    return Response.json(analysis);
  } catch (error) {
    console.error("Erro na analise:", error);
    return new Response("Erro ao processar imagem", { status: 500 });
  }
}
