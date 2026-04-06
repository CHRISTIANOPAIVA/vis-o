import { z } from "zod";
import db from "@/lib/db";

const listMeals = db.prepare(
  "SELECT * FROM meals ORDER BY created_at DESC"
);

const deleteMeal = db.prepare(
  "DELETE FROM meals WHERE id = ?"
);

const updateMeal = db.prepare(
  `UPDATE meals
   SET food_name = ?, calories = ?, protein = ?, carbs = ?, fat = ?, fiber = ?, is_edited = 1
   WHERE id = ?`
);

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
  const meals = listMeals.all();
  return Response.json(meals);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id || typeof id !== "number") {
    return new Response("ID invalido", { status: 400 });
  }
  deleteMeal.run(id);
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
  updateMeal.run(food_name, calories, protein, carbs, fat, fiber, id);
  return Response.json({ ok: true });
}
