"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }

      if (response.status === 401) {
        setError("Senha incorreta.");
      } else if (response.status === 429) {
        setError("Muitas tentativas. Aguarde um minuto e tente novamente.");
      } else {
        setError("Nao foi possivel entrar. Tente novamente.");
      }
    } catch {
      setError("Nao foi possivel entrar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
        <Lock className="w-6 h-6" />
      </div>

      <section className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
        <p className="text-gray-500 text-sm">Digite a senha para acessar o NutriVision.</p>
      </section>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          autoFocus
          disabled={isLoading}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60"
        />

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !password}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-semibold py-3 text-sm transition-all duration-200 disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Entrar
        </button>
      </form>
    </div>
  );
}
