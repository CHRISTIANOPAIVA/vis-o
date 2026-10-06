import { rateLimit, clientKey } from "@/lib/rate-limit";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken } from "@/lib/auth";

// 5 tentativas por minuto por IP - defesa contra forca bruta na senha unica.
// Prefixo "auth:" evita colidir com o limite de outras rotas que tambem
// usam `clientKey` (ex.: analyze-food).
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 60_000;

function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

// Compara dois hashes byte a byte com OR acumulado, sem short-circuit, para
// nao vazar por timing nem o tamanho nem o prefixo correto da senha (o que
// `===` entre strings faria).
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function buildSessionCookie(value: string, maxAgeSeconds: number): string {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  // Secure apenas em produção: em dev via http://localhost o navegador
  // descarta um cookie marcado Secure, o que tornaria o login impossível.
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export async function POST(req: Request) {
  const authSecret = process.env.AUTH_SECRET;
  const appPassword = process.env.APP_PASSWORD;

  // Nunca ecoar o valor de nenhuma variavel de ambiente - so o fato de
  // faltar configuracao, numa mensagem generica.
  if (!authSecret || !appPassword) {
    return jsonResponse({ error: "Autenticacao nao configurada" }, 500);
  }

  const rateLimitKey = `auth:${clientKey(req)}`;
  const limit = rateLimit(rateLimitKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limit.ok) {
    return jsonResponse(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalido" }, 400);
  }

  const password =
    typeof body === "object" && body !== null && "password" in body
      ? (body as Record<string, unknown>).password
      : undefined;

  if (typeof password !== "string") {
    return jsonResponse({ error: "Senha nao fornecida" }, 400);
  }

  const [providedHash, expectedHash] = await Promise.all([sha256(password), sha256(appPassword)]);

  if (!constantTimeEqual(providedHash, expectedHash)) {
    return jsonResponse({ error: "Senha incorreta" }, 401);
  }

  const token = await createSessionToken();
  const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);

  return jsonResponse({ ok: true }, 200, {
    "Set-Cookie": buildSessionCookie(token, maxAgeSeconds),
  });
}

export async function DELETE() {
  // Logout: limpa o cookie com o mesmo nome/path e Max-Age=0.
  return jsonResponse({ ok: true }, 200, {
    "Set-Cookie": buildSessionCookie("", 0),
  });
}
