"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, Flame, Leaf, Pencil, X, Check } from "lucide-react";
import { Meal, UserProfileWithTargets } from "@/types";

const FIELD_LABELS: Record<string, string> = {
  calories: "Calorias (kcal)",
  protein:  "Proteína (g)",
  carbs:    "Carbos (g)",
  fat:      "Gordura (g)",
  fiber:    "Fibras (g)",
};

interface MealHistoryProps {
  refreshKey: number;
  targets?: UserProfileWithTargets | null;
}

function formatDate(isoStr: string): string {
  const date = new Date(isoStr + "Z"); // SQLite datetime('now') is UTC
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(isoStr: string): boolean {
  const date = new Date(isoStr + "Z");
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export function MealHistory({ refreshKey, targets }: MealHistoryProps) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Meal>>({});
  const [saving, setSaving] = useState(false);

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meals");
      const data: Meal[] = await res.json();
      setMeals(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals, refreshKey]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch("/api/meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMeals((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (meal: Meal) => {
    setEditingId(meal.id);
    setEditForm({
      food_name: meal.food_name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      fiber: meal.fiber,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      await fetch("/api/meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editForm }),
      });
      setMeals((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, ...editForm, is_edited: 1 } : m
        )
      );
      setEditingId(null);
      setEditForm({});
    } finally {
      setSaving(false);
    }
  };

  const todayCalories = meals
    .filter((m) => isToday(m.created_at))
    .reduce((sum, m) => sum + m.calories, 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="p-4 rounded-2xl bg-slate-50">
          <Leaf className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-slate-400 text-sm">Nenhuma refeicao registrada ainda.</p>
        <p className="text-slate-300 text-xs">Tire uma foto na aba Diario para comecar!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo do dia */}
      <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-700">
            <Flame className="w-4 h-4 fill-current" />
            <span className="text-sm font-semibold">Calorias hoje</span>
          </div>
          <span className="text-lg font-black text-orange-700">
            {todayCalories}{targets ? ` / ${targets.daily_calories}` : ""} kcal
          </span>
        </div>
        {targets && (
          <div className="w-full h-1.5 bg-orange-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((todayCalories / targets.daily_calories) * 100))}%` }}
            />
          </div>
        )}
      </div>

      {/* Lista de refeicoes */}
      <div className="flex flex-col gap-3">
        {meals.map((meal) => (
          <div
            key={meal.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
          >
            {/* Linha principal */}
            <div className="flex items-center gap-3 p-3">
              {/* Thumbnail */}
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                {meal.image_base64 ? (
                  <img src={meal.image_base64} alt={meal.food_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Leaf className="w-6 h-6" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-slate-800 truncate capitalize leading-tight">
                    {meal.food_name}
                  </p>
                  {meal.is_edited === 1 && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-violet-500 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <Pencil className="w-2.5 h-2.5" /> Editado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-orange-500">{meal.calories} kcal</span>
                  <span className="text-slate-200">·</span>
                  <span className="text-xs text-slate-400">{formatDate(meal.created_at)}</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <MacroBadge label="P" value={meal.protein} color="text-blue-500" />
                  <MacroBadge label="C" value={meal.carbs}   color="text-amber-500" />
                  <MacroBadge label="G" value={meal.fat}     color="text-rose-500" />
                  <MacroBadge label="F" value={meal.fiber}   color="text-purple-500" />
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => editingId === meal.id ? cancelEdit() : startEdit(meal)}
                  className="p-2 rounded-xl text-slate-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                  aria-label="Editar refeição"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(meal.id)}
                  disabled={deletingId === meal.id}
                  className="p-2 rounded-xl text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                  aria-label="Excluir refeição"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form de edição inline */}
            {editingId === meal.id && (
              <div className="border-t border-slate-100 bg-slate-50 p-3 flex flex-col gap-3">
                <input
                  type="text"
                  value={editForm.food_name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, food_name: e.target.value }))}
                  placeholder="Nome do alimento"
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(["calories", "protein", "carbs", "fat", "fiber"] as const).map((field) => (
                    <div key={field} className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400">
                        {FIELD_LABELS[field]}
                      </label>
                      <input
                        type="number" min={0} step={0.1}
                        value={editForm[field] ?? 0}
                        onChange={(e) => setEditForm((f) => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
                        className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(meal.id)}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                  >
                    <Check className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-semibold py-2 px-4 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <X className="w-4 h-4" /> Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MacroBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`text-[10px] font-bold ${color}`}>
      {label} {value}g
    </span>
  );
}
