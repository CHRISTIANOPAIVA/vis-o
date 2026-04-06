import db from "@/lib/db";
import type { DailyNutrition } from "@/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7") || 7));

  const rows = db.prepare(`
    SELECT
      date(created_at) as date,
      ROUND(SUM(calories)) as calories,
      ROUND(SUM(protein), 1) as protein,
      ROUND(SUM(carbs), 1) as carbs,
      ROUND(SUM(fat), 1) as fat,
      ROUND(SUM(fiber), 1) as fiber
    FROM meals
    WHERE created_at >= datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(`-${days} days`) as DailyNutrition[];

  const rowMap = new Map(rows.map((r) => [r.date, r]));
  const result: DailyNutrition[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push(rowMap.get(dateStr) ?? { date: dateStr, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  }

  return Response.json(result);
}
