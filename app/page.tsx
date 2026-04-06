"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { Loader2, BookOpen, Camera, User } from "lucide-react";
import { CameraInput } from "./components/features/camera-input";
import { NutritionCard } from "./components/features/nutrition-card";
import { MealHistory } from "./components/features/meal-history";
import { ProfileForm } from "./components/features/profile-form";
import type { NutritionAnalysis, UserProfileWithTargets } from "@/types";
import { cn } from "@/lib/utils";

const NutritionCharts = dynamic(
  () => import("./components/features/nutrition-charts").then((m) => m.NutritionCharts),
  { ssr: false, loading: () => <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" /> }
);

function convertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

type Tab = "diary" | "history" | "profile";

export default function Home() {
  const [tab, setTab] = useState<Tab>("diary");
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<NutritionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [profile, setProfile] = useState<UserProfileWithTargets | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p: UserProfileWithTargets) => setProfile(p))
      .catch(() => {});
  }, []);

  const handleImagesSelect = async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const images = await Promise.all(files.map(convertToBase64));

      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images })
      });

      if (!response.ok) throw new Error("Falha na analise da IA");

      const result: NutritionAnalysis = await response.json();
      setData(result);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      setError("Ops! Nao consegui analisar essa imagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-0 pb-20">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6">
        <TabButton
          active={tab === "diary"}
          onClick={() => setTab("diary")}
          icon={<Camera className="w-3.5 h-3.5" />}
          label="Diario"
        />
        <TabButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          icon={<BookOpen className="w-3.5 h-3.5" />}
          label="Historico"
        />
        <TabButton
          active={tab === "profile"}
          onClick={() => setTab("profile")}
          icon={<User className="w-3.5 h-3.5" />}
          label="Perfil"
        />
      </div>

      {/* ── DIARY TAB ── */}
      {tab === "diary" && (
        <div className="flex flex-col gap-6">
          <section className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Diario Alimentar</h1>
            <p className="text-gray-500 text-sm">
              Tire uma foto para registrar suas calorias automaticamente.
            </p>
          </section>

          <section>
            <CameraInput onImagesSelect={handleImagesSelect} isLoading={isLoading} />
          </section>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 animate-pulse text-green-600">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-medium">Consultando nutricionista IA...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm text-center border border-red-100">
              {error}
            </div>
          )}

          {data && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Resultado da Analise</h2>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  Confianca:{" "}
                  {data.confidence === "high"
                    ? "Alta"
                    : data.confidence === "medium"
                    ? "Media"
                    : "Baixa"}
                </span>
              </div>
              <NutritionCard data={data} targets={profile} />
            </section>
          )}
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div className="flex flex-col gap-4">
          <section className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
            <p className="text-gray-500 text-sm">Configure suas metas nutricionais personalizadas.</p>
          </section>
          <ProfileForm profile={profile} onSaved={setProfile} />
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div className="flex flex-col gap-4">
          <section className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Historico</h1>
            <p className="text-gray-500 text-sm">Todas as refeicoes registradas.</p>
          </section>
          <NutritionCharts refreshKey={historyKey} targets={profile} />
          <MealHistory refreshKey={historyKey} targets={profile} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-200",
        active
          ? "bg-white text-slate-800 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
