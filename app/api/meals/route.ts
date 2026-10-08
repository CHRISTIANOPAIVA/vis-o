import { z } from "zod";
import db from "@/lib/db";
import { errorResponse, dbErrorResponse } from "@/lib/api";
import type { MealsPage } from "@/types";

const DeleteSchema = z.object({
  id: z.number().int().positive(),
});

const PatchSchema = z.object({
  id:        z.number().int().positive(),
  food_name: z.string().trim().min(1).max(200),
  calories:  z.number().nonnegative(), // coluna numeric: aceita decimal
  protein:   z.number().nonnegative(),
  carbs:     z.number().nonnegative(),
  fat:       z.number().nonnegative(),
  fiber:     z.number().nonnegative(),
});

// Paginacao por cursor (keyset) em `id`: identity cresce na ordem de
// insercao, que e a mesma de `created_at`, e usa o indice da PK. Cada pagina
// traz o thumbnail das refeicoes, entao o tamanho e limitado.
const DEFAULT_PAGE_SIZE = 30;

const ListQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  before: z.coerce.number().int().positive().optional(),
});

const MEAL_COLUMNS =
  "id, created_at, food_name, calories, protein, carbs, fat, fiber, confidence, explanation, image_base64, is_edited";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = ListQuerySchema.safeParse({
    limit:  searchParams.get("limit") ?? undefined,
    before: searchParams.get("before") ?? undefined,
  });
  if (!parsed.success) return errorResponse(400, "Parametros de paginacao invalidos.");

  const { limit, before } = parsed.data;

  // Busca uma linha a mais so para saber se existe proxima pagina.
  let query = db
    .from("meals")
    .select(MEAL_COLUMNS)
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (before !== undefined) query = query.lt("id", before);

  const { data, error } = await query;
  if (error) return dbErrorResponse("Erro ao listar refeicoes", error);

  const hasMore = data.length > limit;
  const meals = hasMore ? data.slice(0, limit) : data;
  const body: MealsPage = { meals, nextCursor: hasMore ? meals[meals.length - 1].id : null };
  return Response.json(body);
}

export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "JSON invalido.");
  }

  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Dados invalidos.");
  }

  const { id } = parsed.data;
  const { data, error } = await db.from("meals").delete().eq("id", id).select("id");
  if (error) return dbErrorResponse("Erro ao excluir refeicao", error);
  if (data.length === 0) return errorResponse(404, "Refeicao nao encontrada.");
  return Response.json({ ok: true });
}

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "JSON invalido.");
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "Dados invalidos.");
  }

  const { id, food_name, calories, protein, carbs, fat, fiber } = parsed.data;
  const { data, error } = await db
    .from("meals")
    .update({ food_name, calories, protein, carbs, fat, fiber, is_edited: true })
    .eq("id", id)
    .select("id");

  if (error) return dbErrorResponse("Erro ao editar refeicao", error);
  if (data.length === 0) return errorResponse(404, "Refeicao nao encontrada.");
  return Response.json({ ok: true });
}
