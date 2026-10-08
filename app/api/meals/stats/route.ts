import db from "@/lib/db";
import { dbErrorResponse } from "@/lib/api";
import { parseTimestamp } from "@/lib/date";
import type { DailyNutrition } from "@/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get("days") ?? "7") || 7));

  // `tz` vem do cliente (não confiável): um valor inválido faz Intl.DateTimeFormat
  // lançar RangeError. Validamos aqui e caímos para "UTC" em caso de erro ou ausência.
  const tzParam = searchParams.get("tz");
  let timeZone = "UTC";
  if (tzParam) {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tzParam });
      timeZone = tzParam;
    } catch {
      timeZone = "UTC";
    }
  }

  // Formatter único, reutilizado para todas as linhas e para o cálculo do "hoje" local.
  const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const since = new Date();
  // Margem de 1 dia: os buckets agora são no fuso do usuário, então o corte UTC
  // poderia excluir refeições que pertencem ao dia local mais antigo da janela.
  // Buscar um pouco mais é inofensivo — linhas fora da janela de `days` simplesmente
  // não casam com nenhum bucket no laço de montagem abaixo.
  since.setDate(since.getDate() - days - 1);

  const { data, error } = await db
    .from("meals")
    .select("created_at, calories, protein, carbs, fat, fiber")
    .gte("created_at", since.toISOString());

  if (error) return dbErrorResponse("Erro ao buscar estatisticas", error);

  // Group by local date (fuso do usuário)
  const grouped = new Map<string, DailyNutrition>();
  for (const row of data ?? []) {
    const date = dayKeyFormatter.format(parseTimestamp(row.created_at));
    const existing = grouped.get(date) ?? { date, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    existing.calories = Math.round(existing.calories + (row.calories ?? 0));
    existing.protein  = Math.round((existing.protein  + (row.protein  ?? 0)) * 10) / 10;
    existing.carbs    = Math.round((existing.carbs    + (row.carbs    ?? 0)) * 10) / 10;
    existing.fat      = Math.round((existing.fat      + (row.fat      ?? 0)) * 10) / 10;
    existing.fiber    = Math.round((existing.fiber    + (row.fiber    ?? 0)) * 10) / 10;
    grouped.set(date, existing);
  }

  // Dia de "hoje" no fuso do usuário, decomposto em ano/mês/dia.
  const [y, m, d] = dayKeyFormatter.format(new Date()).split("-").map(Number);

  const result: DailyNutrition[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // Aritmética de calendário em UTC: Date.UTC normaliza viradas de mês/ano
    // sozinho, sem o bug de DST que `setDate` sobre um Date local introduziria.
    const dateStr = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10);
    result.push(grouped.get(dateStr) ?? { date: dateStr, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  }

  return Response.json(result);
}
