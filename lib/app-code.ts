// lib/app-code.ts
//
// Codigo de acesso opcional para as rotas que gastam credito da Anthropic.
// Com APP_CODE definido, o request precisa trazer o mesmo valor no header
// `x-app-code`; sem a variavel, a checagem fica desligada. O client guarda o
// codigo no localStorage e pede uma vez por aparelho.
import { createHash, timingSafeEqual } from "node:crypto";

export const APP_CODE_HEADER = "x-app-code";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

// Compara os hashes em tempo constante para nao vazar por timing o tamanho
// nem o prefixo correto do codigo.
export function hasAppCode(req: Request): boolean {
  const code = process.env.APP_CODE;
  if (!code) return true;
  return timingSafeEqual(sha256(req.headers.get(APP_CODE_HEADER) ?? ""), sha256(code));
}
