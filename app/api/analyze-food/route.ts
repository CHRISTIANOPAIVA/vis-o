import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60; // hard timeout for image processing

const BodySchema = z.object({
  image: z.string().min(1, "Imagem obrigatoria")
});

export async function POST(req: Request) {
  try {
    const parsed = BodySchema.safeParse(await req.json());

    if (!parsed.success) {
      return new Response("Imagem nao fornecida", { status: 400 });
    }

    const { image } = parsed.data;

    const result = await generateObject({
      model: openai("gpt-4o"), // vision-capable model
      schema: z.object({
        food_name: z.string().describe("Nome curto do prato principal"),
        calories: z.number().describe("Estimativa total de calorias (apenas numeros)"),
        macros: z.object({
          protein: z.number().describe("Proteina em gramas"),
          carbs: z.number().describe("Carboidratos em gramas"),
          fat: z.number().describe("Gorduras em gramas")
        }),
        confidence: z.enum(["high", "medium", "low"]),
        explanation: z.string().describe("Frase curta de analise nutricional (max 20 palavras)")
      }),
      messages: [
        {
          role: "system",
          content:
            "Voce e um nutricionista experiente. Analise a imagem da comida fornecida com precisao. Se a imagem nao for de comida, retorne valores zerados e explique no campo explanation."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analise esta refeicao e estime os macros." },
            { type: "image", image } // base64 image
          ]
        }
      ]
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Erro na analise:", error);
    return new Response("Erro ao processar imagem", { status: 500 });
  }
}
