"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, X, Sparkles, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraInputProps {
  onImageSelect: (file: File) => void;
  isLoading?: boolean;
}

export function CameraInput({ onImageSelect, isLoading }: CameraInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);

  const revokePreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };

  // 1. Limpeza ao desmontar
  useEffect(() => {
    return () => {
      revokePreviewUrl();
      stopStream();
    };
  }, []);

  // 2. Monitora se o vídeo começou a tocar (Fallback de 3s)
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

    timer = setTimeout(() => {
      if (!done) {
        // Se demorar muito, não é necessariamente erro fatal, mas avisamos
        console.warn("Video demorou para iniciar");
      }
    }, 3000);

    return () => {
      video.removeEventListener("playing", markReady);
      video.removeEventListener("canplay", markReady);
      if (timer) clearTimeout(timer);
    };
  }, [streaming]);

  // 3. NOVO FIX: Conecta o stream ao vídeo assim que o elemento <video> renderizar
  useEffect(() => {
    if (streaming && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      
      const playSafe = async () => {
        try {
          await video.play();
        } catch (err) {
          console.error("Erro ao iniciar video no useEffect", err);
        }
      };
      playSafe();
    }
  }, [streaming]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setVideoReady(false);
  };

  // Função simplificada (apenas pega a permissão e atualiza o estado)
  const startCamera = async (
    mode: "user" | "environment" = facingMode,
    allowFallback = true
  ) => {
    const hasNavigator = typeof navigator !== "undefined";
    if (!hasNavigator || !navigator.mediaDevices?.getUserMedia) {
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
    revokePreviewUrl();
    setPreview(null);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });

      // Salva o stream e ativa o modo streaming
      // O useEffect #3 vai pegar isso e conectar no <video>
      streamRef.current = stream;
      setFacingMode(mode);
      setVideoReady(false);
      setStreaming(true);

    } catch (err) {
      console.error("Camera error", err);
      const domError = err as DOMException;
      
      if (allowFallback && mode === "environment") {
        await startCamera("user", false);
        return;
      }
      
      if (domError?.name === "NotAllowedError") {
        setError("Permissao da camera negada. Libere o acesso no navegador.");
      } else if (domError?.name === "NotFoundError") {
        setError("Nenhuma camera encontrada.");
      } else {
        setError("Erro ao acessar a camera.");
      }
      stopStream();
      // Opcional: abrir seletor de arquivo se falhar a camera
      // inputRef.current?.click(); 
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !videoReady) {
      setError("A camera ainda esta iniciando. Aguarde...");
      return;
    }

    const canvas = document.createElement("canvas");
    // Usa o tamanho real do vídeo
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: blob.type });
        const objectUrl = URL.createObjectURL(blob);
        revokePreviewUrl();
        previewUrlRef.current = objectUrl;
        setPreview(objectUrl);
        setError(null);
        onImageSelect(file);
        stopStream();
      },
      "image/jpeg",
      0.92
    );
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    revokePreviewUrl();
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreview(objectUrl);
    setError(null);
    stopStream();
    onImageSelect(file);
  };

  const clearImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    revokePreviewUrl();
    setPreview(null);
    setError(null);
    stopStream();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full group">
     <input
        id="camera-input"
        ref={inputRef}
        type="file"
        accept="image/*"  // Removi o ";capture=camera" e o atributo capture
        className="sr-only"
        onChange={handleFileChange}
      />

      {streaming ? (
        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden border border-emerald-100 bg-black">
          {/* O vídeo renderiza aqui. O useEffect vai achá-lo via ref */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!videoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
              Iniciando camera...
            </div>
          )}
          <div className="absolute inset-0 flex items-end justify-between p-4 gap-3">
            <button
              type="button"
              onClick={clearImage}
              className="px-4 py-2 rounded-full bg-white/80 text-slate-800 text-sm font-medium shadow"
            >
              Cancelar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  stopStream();
                  startCamera(facingMode === "environment" ? "user" : "environment");
                }}
                className="px-3 py-2 rounded-full bg-white/70 text-slate-800 text-sm font-medium shadow hover:bg-white"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!videoReady}
                className="px-4 py-2 rounded-full bg-emerald-500 text-white font-semibold shadow hover:bg-emerald-600 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Tirar foto
              </button>
            </div>
          </div>
        </div>
      ) : !preview ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => startCamera()}
              className="flex-1 relative aspect-[4/3] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:bg-slate-100 hover:border-emerald-300 active:scale-[0.98] active:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="z-10 h-16 w-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-emerald-600 transition-transform group-active:scale-90">
                <Camera className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <div className="z-10 text-center px-4">
                <p className="font-semibold text-slate-700">Usar camera</p>
                <p className="text-sm text-slate-400 mt-1">Clique para abrir</p>
              </div>
            </button>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full text-sm text-slate-500 underline underline-offset-4 hover:text-slate-700"
          >
            Ou selecione um arquivo da galeria
          </button>
          {error && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle className="h-3.5 w-3.5" /> {error}
            </p>
          )}
        </div>
      ) : (
        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100 group animate-in fade-in zoom-in-95 duration-300">
          <img
            src={preview}
            alt="Preview"
            className={cn(
              "w-full h-full object-cover transition-all duration-500",
              isLoading && "scale-105 blur-sm grayscale-[0.5]"
            )}
          />

          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] text-white">
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-full mb-3 shadow-lg">
                <Sparkles className="w-6 h-6 animate-pulse text-emerald-300" />
              </div>
              <p className="font-medium text-sm tracking-wide animate-pulse">Consultando IA...</p>
            </div>
          ) : (
            <button
              onClick={clearImage}
              className="absolute top-4 right-4 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-90 shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}