// lib/auth.ts
//
// Emissao e verificacao do token de sessao do gate de senha unica.
// Este modulo e importado tanto pelo proxy.ts quanto pela
// route handler de login. Usa apenas Web Crypto (crypto.subtle), que roda
// em qualquer runtime (Node ou Edge), em vez de node:crypto.

export const SESSION_COOKIE = "nv_session";

// TTL padrao da sessao: 30 dias. E um app pessoal de um unico usuario -
// pedir a senha todo dia seria hostil sem ganho real de seguranca.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function base64UrlEncode(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  const base64 = btoa(binary);
  // base64url: sem '+', '/', '=' - cabe num cookie sem precisar de escaping.
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Cria um token de sessao no formato `<exp>.<assinaturaBase64Url>`, onde
 * `exp` e o timestamp de expiracao (ms) e a assinatura e o HMAC-SHA256 de
 * `exp` (como string) usando AUTH_SECRET como chave.
 */
export async function createSessionToken(ttlMs: number = SESSION_TTL_MS): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET nao configurado");

  const exp = Date.now() + ttlMs;
  const expStr = String(exp);
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expStr));
  return `${expStr}.${base64UrlEncode(signature)}`;
}

/**
 * Verifica um token de sessao. Nunca lanca excecao para entrada malformada
 * - token invalido/ausente/expirado apenas retorna `false`.
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  // Fail closed: sem segredo configurado, nenhum token pode ser considerado
  // valido (ver tambem proxy.ts, que checa isso de forma independente).
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex === token.length - 1) return false;

  const expStr = token.slice(0, dotIndex);
  const sigB64 = token.slice(dotIndex + 1);

  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return false;
  if (exp < Date.now()) return false;

  try {
    const key = await getHmacKey(secret);
    const signature = base64UrlDecode(sigB64);
    return await crypto.subtle.verify("HMAC", key, signature as BufferSource, new TextEncoder().encode(expStr));
  } catch {
    // base64 invalido ou qualquer outra falha de formato: trata como token
    // invalido, nunca propaga erro (um token lixo nao pode virar 500).
    return false;
  }
}
