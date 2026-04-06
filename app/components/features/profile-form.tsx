"use client";

import { useState, useEffect, useMemo } from "react";
import { UserProfileWithTargets, GoalType, Sex } from "@/types";
import { computeTargets } from "@/lib/nutrition";
import { User, Target, Save, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileFormProps {
  profile: UserProfileWithTargets | null;
  onSaved: (p: UserProfileWithTargets) => void;
}

const GOAL_LABELS: Record<GoalType, string> = {
  lose_weight: "Emagrecer",
  maintain:    "Manter peso",
  gain_muscle: "Ganhar massa",
};

const TARGET_COLORS: Record<string, string> = {
  orange: "bg-orange-100 text-orange-700",
  blue:   "bg-blue-100 text-blue-700",
  amber:  "bg-amber-100 text-amber-700",
  rose:   "bg-rose-100 text-rose-700",
};

const INPUT_CLASS = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const [weight, setWeight] = useState(profile?.weight_kg ?? 70);
  const [height, setHeight] = useState(profile?.height_cm ?? 170);
  const [age, setAge]       = useState(profile?.age ?? 25);
  const [sex, setSex]       = useState<Sex>(profile?.sex ?? "male");
  const [goal, setGoal]     = useState<GoalType>(profile?.goal ?? "maintain");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  // Sync when profile loads for the first time (null → value)
  useEffect(() => {
    if (profile) {
      setWeight(profile.weight_kg);
      setHeight(profile.height_cm);
      setAge(profile.age);
      setSex(profile.sex);
      setGoal(profile.goal);
    }
  }, [profile]);

  const preview = useMemo(
    () => computeTargets({ weight_kg: weight, height_cm: height, age, sex, goal }),
    [weight, height, age, sex, goal]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: weight, height_cm: height, age, sex, goal }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      const updated: UserProfileWithTargets = await res.json();
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <User className="w-4 h-4" />
          Dados pessoais
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Peso (kg)">
            <input type="number" min={30} max={300} step={0.1} value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} className={INPUT_CLASS} />
          </Field>
          <Field label="Altura (cm)">
            <input type="number" min={100} max={250} value={height}
              onChange={(e) => setHeight(parseFloat(e.target.value) || 0)} className={INPUT_CLASS} />
          </Field>
          <Field label="Idade">
            <input type="number" min={1} max={120} value={age}
              onChange={(e) => setAge(parseInt(e.target.value) || 0)} className={INPUT_CLASS} />
          </Field>
          <Field label="Sexo">
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={INPUT_CLASS}>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </Field>
        </div>

        <Field label="Objetivo">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(GOAL_LABELS) as GoalType[]).map((g) => (
              <button key={g} type="button" onClick={() => setGoal(g)}
                className={cn(
                  "py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center",
                  goal === g
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                )}>
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
          <Target className="w-4 h-4" />
          Suas metas diárias
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TargetPill label="Calorias" value={preview.daily_calories} unit="kcal" color="orange" />
          <TargetPill label="Proteína" value={preview.daily_protein}  unit="g"    color="blue" />
          <TargetPill label="Carbos"   value={preview.daily_carbs}    unit="g"    color="amber" />
          <TargetPill label="Gordura"  value={preview.daily_fat}      unit="g"    color="rose" />
        </div>
      </div>

      <button type="submit" disabled={saving}
        className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-2xl transition-colors">
        {saved ? (
          <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
        ) : (
          <><Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar perfil"}</>
        )}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function TargetPill({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className={cn("rounded-xl px-3 py-2 flex justify-between items-center", TARGET_COLORS[color])}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-sm font-bold">{value}{unit}</span>
    </div>
  );
}
