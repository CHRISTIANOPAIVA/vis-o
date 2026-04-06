"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, X, Sparkles, AlertTriangle, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraInputProps {
  onImagesSelect: (files: File[]) => void;
  isLoading?: boolean;
}

export function CameraInput({ onImagesSelect, isLoading }: CameraInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);

  const MAX_PHOTOS = 5;

  // Keep ref in sync so the unmount cleanup can revoke the latest URLs (stale closure workaround)
  useEffect(() => { previewUrlsRef.current = previewUrls; }, [previewUrls]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      stopStream();
    };
  }, []);

  useEffect(() => {
    if (!streaming || !videoRef.current) return;
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const video = videoRef.current;

    const markReady = () => {
      if (done) return;
      if (video.videoWidth && video.videoHeight) {
        setVideoReady(true);
        setError(null);
        done = true;
        if (timer) clearTimeout(timer);
      }
    };

    video.addEventListener("playing", markReady);
    video.addEventListener("canplay", markReady);
    timer = setTimeout(() => { if (!done) console.warn("Video demorou para iniciar"); }, 3000);

    return () => {
      video.removeEventListener("playing", markReady);
      video.removeEventListener("canplay", markReady);
      if (timer) clearTimeout(timer);
    };
  }, [streaming]);

  useEffect(() => {
    if (streaming && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch((err) => console.error("Erro ao iniciar video", err));
    }
  }, [streaming]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
    setVideoReady(false);
  };

  const startCamera = async (mode: "user" | "environment" = facingMode, allowFallback = true) => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Dispositivo nao suporta captura pela camera.");
      inputRef.current?.click();
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setError("A camera precisa de conexao segura (https ou localhost).");
      inputRef.current?.click();
      return;
    }

    stopStream();
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(mode);
      setVideoReady(false);
      setStreaming(true);
    } catch (err) {
      const domError = err as DOMException;
      if (allowFallback && mode === "environment") {
        await startCamera("user", false);
        return;
      }
      if (domError?.name === "NotAllowedError") setError("Permissao da camera negada.");
      else if (domError?.name === "NotFoundError") setError("Nenhuma camera encontrada.");
      else setError("Erro ao acessar a camera.");
      stopStream();
    }
  };

  const addFile = (file: File, objectUrl: string) => {
    setCapturedFiles((prev) => [...prev, file]);
    setPreviewUrls((prev) => [...prev, objectUrl]);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !videoReady) {
      setError("A camera ainda esta iniciando. Aguarde...");
      return;
    }
    if (capturedFiles.length >= MAX_PHOTOS) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: blob.type });
      const objectUrl = URL.createObjectURL(blob);
      addFile(file, objectUrl);
      setError(null);
      stopStream();
    }, "image/jpeg", 0.92);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_PHOTOS - capturedFiles.length;
    const toAdd = files.slice(0, remaining);
    toAdd.forEach((file) => {
      const objectUrl = URL.createObjectURL(file);
      addFile(file, objectUrl);
    });
    setError(null);
    stopStream();
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setCapturedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setCapturedFiles([]);
    setPreviewUrls([]);
    setError(null);
    stopStream();
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAnalyze = () => {
    if (capturedFiles.length > 0) onImagesSelect(capturedFiles);
  };

  const canAddMore = capturedFiles.length < MAX_PHOTOS && !isLoading;

  return (
    <div className="w-full flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />

      {/* Visualizador da câmera */}
      {streaming && (
        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden border border-emerald-100 bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!videoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
              Iniciando camera...
            </div>
          )}
          <div className="absolute inset-0 flex items-end justify-between p-4 gap-3">
            <button type="button" onClick={stopStream}
              className="px-4 py-2 rounded-full bg-white/80 text-slate-800 text-sm font-medium shadow">
              Cancelar
            </button>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { stopStream(); startCamera(facingMode === "environment" ? "user" : "environment"); }}
                className="px-3 py-2 rounded-full bg-white/70 text-slate-800 text-sm font-medium shadow hover:bg-white">
                Trocar
              </button>
              <button type="button" onClick={capturePhoto} disabled={!videoReady}
                className="px-4 py-2 rounded-full bg-emerald-500 text-white font-semibold shadow hover:bg-emerald-600 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
                Tirar foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Galeria de fotos capturadas */}
      {previewUrls.length > 0 && !streaming && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {previewUrls.map((url, i) => (
            <div key={i} className="relative flex-shrink-0 w-20 h-20 rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <img src={url} alt={`Foto ${i + 1}`} className={cn("w-full h-full object-cover", isLoading && "opacity-60")} />
              {!isLoading && (
                <button onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {/* Botão para adicionar mais fotos */}
          {canAddMore && (
            <button type="button"
              onClick={() => startCamera()}
              className="flex-shrink-0 w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors">
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Foto</span>
            </button>
          )}
        </div>
      )}

      {/* Área de captura vazia */}
      {!streaming && previewUrls.length === 0 && (
        <div className="space-y-3">
          <button type="button" onClick={() => startCamera()}
            className="w-full relative aspect-[4/3] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:bg-slate-100 hover:border-emerald-300 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-emerald-500/10 cursor-pointer">
            <div className="h-16 w-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-emerald-600">
              <Camera className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <div className="text-center px-4">
              <p className="font-semibold text-slate-700">Usar camera</p>
              <p className="text-sm text-slate-400 mt-1">Clique para abrir</p>
            </div>
          </button>
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full text-sm text-slate-500 underline underline-offset-4 hover:text-slate-700">
            Ou selecione da galeria
          </button>
        </div>
      )}

      {/* Botão analisar + botão limpar */}
      {previewUrls.length > 0 && !streaming && (
        <div className="flex gap-2">
          <button type="button" onClick={handleAnalyze} disabled={isLoading || capturedFiles.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl transition-colors">
            {isLoading ? (
              <><Sparkles className="w-4 h-4 animate-pulse" /> Analisando...</>
            ) : (
              <><Scan className="w-4 h-4" /> Analisar {capturedFiles.length} foto{capturedFiles.length > 1 ? "s" : ""}</>
            )}
          </button>
          {!isLoading && (
            <button type="button" onClick={clearAll}
              className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Erro */}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
