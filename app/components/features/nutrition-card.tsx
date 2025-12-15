import { NutritionAnalysis } from "@/types";
import { Flame, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NutritionCardProps {
  data: NutritionAnalysis;
}

export function NutritionCard({ data }: NutritionCardProps) {
  return (
    <div className="w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-700 fill-mode-backwards">
      {/* Cabecalho do Card */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-800 leading-tight capitalize">
              {data.food_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-2">
              <CheckCircle2
                className={cn(
                  "w-4 h-4",
                  data.confidence === "high" ? "text-emerald-500" : "text-amber-500"
                )}
              />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Confianca {data.confidence === "high" ? "Alta" : "Media"}
              </span>
            </div>
          </div>
          <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-100/50">
            IA
          </div>
        </div>
        <p className="text-slate-500 text-sm mt-4 leading-relaxed border-l-2 border-slate-100 pl-3">
          {data.explanation}
        </p>
      </div>

      {/* Grid de Estatisticas */}
      <div className="p-4 bg-slate-50/50 border-t border-slate-100">
        <div className="grid grid-cols-2 gap-3">
          {/* Calorias (Grande Destaque) */}
          <div className="col-span-2 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-100 rounded-xl text-orange-600">
                <Flame className="w-5 h-5 fill-current" />
              </div>
              <span className="font-semibold text-slate-600">Energia</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-slate-800 block leading-none">
                {data.calories}
              </span>
              <span className="text-xs text-slate-400 font-medium uppercase">Kcal</span>
            </div>
          </div>

          {/* Macros (Pills) */}
          <MacroPill label="Proteina" value={data.macros.protein} color="blue" />
          <MacroPill label="Carbos" value={data.macros.carbs} color="amber" />
          <MacroPill label="Gordura" value={data.macros.fat} color="rose" />

          {/* Espaco Vazio ou Outro Dado (ex: Fibras no futuro) */}
          <div className="rounded-2xl border border-dashed border-slate-200 bg-transparent flex items-center justify-center">
            <span className="text-xs text-slate-300 font-medium">...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  const colorStyles: Record<string, { bg: string; text: string; bar: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
    rose: { bg: "bg-rose-50", text: "text-rose-700", bar: "bg-rose-500" }
  };

  const style = colorStyles[color];

  return (
    <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-24">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text} opacity-80`}>
        {label}
      </span>
      <div>
        <span className="text-lg font-bold text-slate-700">{value}g</span>
        {/* Barra de progresso visual fake para estetica */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
          <div className={`h-full rounded-full ${style.bar} opacity-80 w-[60%]`} />
        </div>
      </div>
    </div>
  );
}
