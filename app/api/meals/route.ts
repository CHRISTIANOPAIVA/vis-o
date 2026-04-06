import { z } from "zod";
import db from "@/lib/db";

const PatchSchema = z.object({
  id:        z.number().int().positive(),
  food_name: z.string().min(1),
  calories:  z.number().int().nonnegative(),
  protein:   z.number().nonnegative(),
  carbs:     z.number().nonnegative(),
  fat:       z.number().nonnegative(),
  fiber:     z.number().nonnegative(),
});

export async function GET() {
  const { data, error } = await db
    .from("meals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id || typeof id !== "number") {
    return new Response("ID invalido", { status: 400 });
  }

  const { error } = await db.from("meals").delete().eq("id", id);
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
  }

  const { id, food_name, calories, protein, carbs, fat, fiber } = parsed.data;
  const { error } = await db
    .from("meals")
    .update({ food_name, calories, protein, carbs, fat, fiber, is_edited: true })
    .eq("id", id);

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}
