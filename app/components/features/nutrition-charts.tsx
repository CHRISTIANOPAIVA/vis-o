"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";
import type { DailyNutrition, UserProfileWithTargets } from "@/types";

interface NutritionChartsProps {
  refreshKey: number;
  targets?: UserProfileWithTargets | null;
}

type Period = 7 | 30;

function shortDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export function NutritionCharts({ refreshKey, targets }: NutritionChartsProps) {
  const [days, setDays] = useState<Period>(7);
  const [data, setData] = useState<DailyNutrition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meals/stats?days=${days}`)
      .then((r) => r.json())
      .then((d: DailyNutrition[]) => setData(d))
      .finally(() => setLoading(false));
  }, [days, refreshKey]);

  const chartData = useMemo(() => data.map((d) => ({ ...d, date: shortDate(d.date) })), [data]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Evolução nutricional</h3>
        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-xl">
          {([7, 30] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all ${
                days === p ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-36 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-36 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      ) : (
        <>
          {/* Gráfico de Calorias */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Calorias (kcal/dia)</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(v: number) => [`${v} kcal`, "Calorias"]}
                />
                {targets && (
                  <ReferenceLine y={targets.daily_calories} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5} />
                )}
                <Bar dataKey="calories" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico de Macros */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Macros (g/dia)</p>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(v: number, name: string) => [`${v}g`, name]}
                />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="protein" stackId="1" stroke="#3b82f6" fill="#bfdbfe" name="Proteína" />
                <Area type="monotone" dataKey="carbs"   stackId="1" stroke="#f59e0b" fill="#fde68a" name="Carbos" />
                <Area type="monotone" dataKey="fat"     stackId="1" stroke="#f43f5e" fill="#fecdd3" name="Gordura" />
                <Area type="monotone" dataKey="fiber"   stackId="1" stroke="#a855f7" fill="#e9d5ff" name="Fibras" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
