import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import sharp from "sharp";
import db from "@/lib/db";

export const maxDuration = 60;

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

export async function POST(req: Request) {
  try {
    const parsed = BodySchema.safeParse(await req.json());

    if (!parsed.success) {
      return new Response("Imagem nao fornecida", { status: 400 });
    }

    const { images } = parsed.data;

    const result = await generateObject({
      model: google(process.env.GOOGLE_MODEL ?? "gemini-2.0-flash"),
      schema: z.object({
        food_name: z.string().describe("Nome curto do prato principal"),
        calories: z.number().describe("Estimativa total de calorias (apenas numeros)"),
        macros: z.object({
          protein: z.number().describe("Proteina em gramas"),
          carbs: z.number().describe("Carboidratos em gramas"),
          fat: z.number().describe("Gorduras em gramas"),
          fiber: z.number().describe("Fibras alimentares em gramas")
        }),
        confidence: z.enum(["high", "medium", "low"]),
        explanation: z.string().describe("Frase curta de analise nutricional (max 20 palavras)")
      }),
      messages: [
        {
          role: "system",
          content:
            "Voce e um nutricionista experiente. Analise as imagens da comida fornecidas com precisao. Se houver multiplas imagens, some os macros de todos os alimentos como se fossem uma unica refeicao. Estime calorias, proteinas, carboidratos, gorduras e fibras alimentares. Se as imagens nao forem de comida, retorne valores zerados e explique no campo explanation."
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Analise esta refeicao (${images.length} foto${images.length > 1 ? "s" : ""}) e estime os macros totais combinados.` },
            ...images.map((img) => ({ type: "image" as const, image: img }))
          ]
        }
      ]
    });

    const analysis = result.object;

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
    const msg = error instanceof Error ? error.message + "\n" + error.stack : String(error);
    console.error("Erro na analise:", msg);
    return new Response(msg, { status: 500 });
  }
}
