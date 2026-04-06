import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import sharp from "sharp";
import db from "@/lib/db";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BodySchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(5),
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
    const model = process.env.ANTHROPIC_MODEL ?? "claude-3-haiku-20240307";

    const imageContent = images.map((img) => {
      const { data, mediaType } = extractBase64(img);
      return {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data },
      };
    });

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: "Voce e um nutricionista experiente. Analise as imagens da comida fornecidas com precisao. Responda APENAS com um JSON valido seguindo exatamente o schema fornecido, sem texto adicional.",
      messages: [
        {
          role: "user",
          content: [
            ...imageContent,
            {
              type: "text",
              text: `Analise esta refeicao (${images.length} foto${images.length > 1 ? "s" : ""}) e retorne um JSON com este formato exato:
{
  "food_name": "nome curto do prato",
  "calories": numero_total,
  "macros": {
    "protein": gramas,
    "carbs": gramas,
    "fat": gramas,
    "fiber": gramas
  },
  "confidence": "high" ou "medium" ou "low",
  "explanation": "frase curta max 20 palavras"
}`
            }
          ]
        }
      ]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response: " + text);

    const analysis = JSON.parse(jsonMatch[0]);

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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Erro na analise:", msg);
    return new Response(msg, { status: 500 });
  }
}
