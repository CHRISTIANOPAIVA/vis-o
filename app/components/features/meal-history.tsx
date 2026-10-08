"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, Flame, Leaf, Pencil, X, Check } from "lucide-react";
import { Meal, MealsPage, UserProfileWithTargets } from "@/types";
import { parseTimestamp } from "@/lib/date";

const FIELD_LABELS: Record<string, string> = {
  calories: "Calorias (kcal)",
  protein:  "Proteína (g)",
  carbs:    "Carbos (g)",
  fat:      "Gordura (g)",
  fiber:    "Fibras (g)",
};

type NumField = "calories" | "protein" | "carbs" | "fat" | "fiber";
const NUM_FIELDS: NumField[] = ["calories", "protein", "carbs", "fat", "fiber"];
type EditForm = { food_name: string } & Record<NumField, string>;

const GENERIC_ERROR = "Nao foi possivel concluir a operacao. Tente novamente.";

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string" && body.error) return body.error;
  } catch {
    // corpo nao e JSON
  }
  return GENERIC_ERROR;
}

interface MealHistoryProps {
  refreshKey: number;
  targets?: UserProfileWithTargets | null;
}

function formatDate(isoStr: string): string {
  const date = parseTimestamp(isoStr);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(isoStr: string): boolean {
  const date = parseTimestamp(isoStr);
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const setRowError = (id: number, msg: string | null) =>
    setRowErrors((prev) => {
      const next = { ...prev };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });

  // Confirmacao de exclusao expira apos alguns segundos
  useEffect(() => {
    if (confirmId === null) return;
    const t = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(t);
  }, [confirmId]);

  const fetchPage = async (before: number | null): Promise<MealsPage | null> => {
    try {
      const res = await fetch(before === null ? "/api/meals" : `/api/meals?before=${before}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Erro ao carregar refeicoes:", err);
      return null;
    }
  };

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    const page = await fetchPage(null);
    setLoadError(page === null);
    setMeals(page?.meals ?? []);
    setNextCursor(page?.nextCursor ?? null);
    setLoading(false);
  }, []);

  const loadMore = async () => {
    if (nextCursor === null) return;
    setLoadingMore(true);
    const page = await fetchPage(nextCursor);
    if (page) {
      setMeals((prev) => [...prev, ...page.meals]);
      setNextCursor(page.nextCursor);
    }
    setLoadError(page === null);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals, refreshKey]);

  const handleDelete = async (id: number) => {
    setConfirmId(null);
    setDeletingId(id);
    setRowError(id, null);
    try {
      const res = await fetch("/api/meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.ok || res.status === 404) {
        setMeals((prev) => prev.filter((m) => m.id !== id));
        return;
      }
      setRowError(id, await readError(res));
    } catch {
      setRowError(id, GENERIC_ERROR);
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (meal: Meal) => {
    setEditingId(meal.id);
    setRowError(meal.id, null);
    setEditForm({
      food_name: meal.food_name,
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fat: String(meal.fat),
      fiber: String(meal.fiber),
    });
  };

  const cancelEdit = () => {
    if (editingId !== null) setRowError(editingId, null);
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async (id: number) => {
    if (!editForm) return;
    const name = editForm.food_name.trim();
    if (!name) {
      setRowError(id, "Informe o nome do alimento.");
      return;
    }
    const values = {} as Record<NumField, number>;
    for (const field of NUM_FIELDS) {
      const raw = editForm[field].trim();
      const n = raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setRowError(id, `Valor invalido em ${FIELD_LABELS[field]}.`);
        return;
      }
      values[field] = n;
    }
    setSaving(true);
    setRowError(id, null);
    try {
      const res = await fetch("/api/meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, food_name: name, ...values }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      // Excluida em outra aba/dispositivo: tira da lista em vez de mostrar erro.
      if (res.status === 404) {
        setMeals((prev) => prev.filter((m) => m.id !== id));
        setEditingId(null);
        setEditForm(null);
        return;
      }
      if (!res.ok) {
        setRowError(id, await readError(res));
        return;
      }
      setMeals((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, food_name: name, ...values, is_edited: true } : m
        )
      );
      setEditingId(null);
      setEditForm(null);
    } catch {
      setRowError(id, GENERIC_ERROR);
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

  if (loadError && meals.length === 0) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm text-center border border-red-100">
        Nao consegui carregar o historico. Tente novamente mais tarde.
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
                  {meal.is_edited && (
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
                {confirmId === meal.id ? (
                  <button
                    onClick={() => handleDelete(meal.id)}
                    disabled={deletingId === meal.id}
                    className="p-2 rounded-xl text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"
                    aria-label="Confirmar exclusão da refeição"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmId(meal.id)}
                    disabled={deletingId === meal.id}
                    className="p-2 rounded-xl text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                    aria-label="Excluir refeição"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {confirmId === meal.id && (
              <p role="status" className="px-3 pb-2 text-xs text-red-500">
                Toque novamente em confirmar para excluir.
              </p>
            )}
            {rowErrors[meal.id] && editingId !== meal.id && (
              <p role="alert" className="px-3 pb-2 text-xs text-red-500">{rowErrors[meal.id]}</p>
            )}

            {/* Form de edição inline */}
            {editingId === meal.id && editForm && (
              <div className="border-t border-slate-100 bg-slate-50 p-3 flex flex-col gap-3">
                <input
                  type="text"
                  value={editForm.food_name}
                  maxLength={200}
                  onChange={(e) => setEditForm((f) => (f ? { ...f, food_name: e.target.value } : f))}
                  placeholder="Nome do alimento"
                  className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  {NUM_FIELDS.map((field) => (
                    <div key={field} className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400">
                        {FIELD_LABELS[field]}
                      </label>
                      <input
                        type="number" min={0} step={0.1}
                        value={editForm[field]}
                        onChange={(e) => setEditForm((f) => (f ? { ...f, [field]: e.target.value } : f))}
                        className="text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400"
                      />
                    </div>
                  ))}
                </div>
                {rowErrors[meal.id] && (
                  <p role="alert" className="text-xs text-red-500">{rowErrors[meal.id]}</p>
                )}
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

      {loadError && (
        <p className="text-xs text-center text-red-500">Nao consegui carregar mais refeicoes.</p>
      )}

      {nextCursor !== null && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full bg-white border border-slate-200 text-slate-600 text-sm font-semibold py-2 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          {loadingMore ? "Carregando..." : "Carregar mais"}
        </button>
      )}
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
