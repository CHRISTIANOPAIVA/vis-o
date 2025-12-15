import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Leaf } from "lucide-react"; // Troquei para Leaf para ficar mais 'eco/nutri'

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "NutriVision",
  description: "IA Nutricional",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} h-full bg-slate-50`}>
        <div className="mx-auto flex h-full max-w-md flex-col bg-white shadow-2xl overflow-hidden relative">
          
          {/* Header Glassmorphism */}
          <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-100/50 supports-[backdrop-filter]:bg-white/60">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                <Leaf className="h-5 w-5 fill-current" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-800">NutriVision</span>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-emerald-100 to-teal-50 border border-emerald-100 shadow-sm" /> 
          </header>

          {/* Conteúdo com padding top para compensar o header fixo */}
          <main className="flex-1 overflow-y-auto pt-24 pb-8 px-6 no-scrollbar space-y-8">
            {children}
          </main>

        </div>
      </body>
    </html>
  );
}