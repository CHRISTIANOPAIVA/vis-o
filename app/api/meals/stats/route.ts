import db from "@/lib/db";
import type { DailyNutrition } from "@/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7") || 7));

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from("meals")
    .select("created_at, calories, protein, carbs, fat, fiber")
    .gte("created_at", since.toISOString());

  if (error) return new Response(error.message, { status: 500 });

  // Group by date
  const grouped = new Map<string, DailyNutrition>();
  for (const row of data ?? []) {
    const date = row.created_at.slice(0, 10);
    const existing = grouped.get(date) ?? { date, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    existing.calories = Math.round(existing.calories + (row.calories ?? 0));
    existing.protein  = Math.round((existing.protein  + (row.protein  ?? 0)) * 10) / 10;
    existing.carbs    = Math.round((existing.carbs    + (row.carbs    ?? 0)) * 10) / 10;
    existing.fat      = Math.round((existing.fat      + (row.fat      ?? 0)) * 10) / 10;
    existing.fiber    = Math.round((existing.fiber    + (row.fiber    ?? 0)) * 10) / 10;
    grouped.set(date, existing);
  }

  const result: DailyNutrition[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push(grouped.get(dateStr) ?? { date: dateStr, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  }

  return Response.json(result);
}
