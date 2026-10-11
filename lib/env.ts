// lib/env.ts
//
// Validacao das variaveis de ambiente do Supabase no servidor. Falha cedo com
// uma mensagem que NOMEIA as variaveis com problema, em vez do erro confuso
// do client ("supabaseUrl is required"). A mensagem e montada so a partir dos
// `path` dos issues: os valores sao segredos e nunca podem aparecer nela.
// ANTHROPIC_* tem tratamento proprio na rota de analise.
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) return result.data;

  const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
  throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${names.join(", ")}. Veja .env.example.`);
}
