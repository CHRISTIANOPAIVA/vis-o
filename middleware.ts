import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Escopo do gate: tudo, exceto os bundles estaticos do Next (que nao tem
// nada sensivel e rodar middleware neles e so custo). As demais excecoes
// (rota de login, rota de login da API, manifest/icones do PWA) sao
// tratadas DENTRO da funcao abaixo tambem - cinto e suspensorio - entao
// mesmo que este matcher mude no futuro, elas continuam liberadas.
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

// Caminhos que sempre passam, com ou sem sessao.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/")
  );
}

// `/api/auth` precisa ficar liberado (senao e impossivel logar/deslogar),
// mas sem liberar o restante de `/api/*` por engano.
function isPublicApiPath(pathname: string): boolean {
  return pathname === "/api/auth";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname) || isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");

  // Fail closed: se AUTH_SECRET ou APP_PASSWORD nao estiverem definidos, o
  // app NUNCA libera acesso - sempre nega (401 para API, redirect para
  // paginas). Um app que abre sozinho quando a config falta e pior do que
  // nao ter gate nenhum. `verifySessionToken` ja falha fechado sozinho
  // quando falta AUTH_SECRET; checamos APP_PASSWORD aqui tambem para que a
  // ausencia de qualquer uma das duas variaveis bloqueie o acesso.
  const isConfigured = Boolean(process.env.AUTH_SECRET) && Boolean(process.env.APP_PASSWORD);

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authorized = isConfigured && (await verifySessionToken(token));

  if (authorized) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}
