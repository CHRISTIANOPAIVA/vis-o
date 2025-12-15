"use client";

import { useState } from "react";
import { CameraInput } from "./components/features/camera-input";
import { NutritionCard } from "./components/features/nutrition-card";
import { Loader2 } from "lucide-react";
import { NutritionAnalysis } from "@/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<NutritionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Funcao auxiliar para converter File -> Base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      // 1. Converte a imagem para enviar no JSON
      const base64Image = await convertToBase64(file);

      // 2. Chama nossa API (o cerebro)
      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image })
      });

      if (!response.ok) throw new Error("Falha na analise da IA");

      const result: NutritionAnalysis = await response.json();
      setData(result);
    } catch (err) {
      console.error(err);
      setError("Ops! Nao consegui analisar essa imagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Cabecalho de boas-vindas */}
      <section className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Diario Alimentar</h1>
        <p className="text-gray-500 text-sm">
          Tire uma foto para registrar suas calorias automaticamente.
        </p>
      </section>

      {/* Area principal: camera */}
      <section>
        <CameraInput onImageSelect={handleImageSelect} isLoading={isLoading} />
      </section>

      {/* Estados de feedback */}
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

      {/* Resultado final */}
      {data && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Resultado da Analise</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
              Confianca: {data.confidence === "high" ? "Alta" : data.confidence === "medium" ? "Media" : "Baixa"}
            </span>
          </div>
          <NutritionCard data={data} />
        </section>
      )}
    </div>
  );
}
