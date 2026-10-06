// lib/api.ts
//
// Respostas de erro das rotas de API. Formato unico `{ error }` (o mesmo do
// middleware), e detalhes internos (mensagens do Postgres/Supabase) ficam so
// no log do servidor, nunca na resposta.

export function errorResponse(status: number, error: string, headers?: Record<string, string>): Response {
  return Response.json({ error }, { status, headers });
}

export function dbErrorResponse(context: string, error: { message: string }): Response {
  console.error(`${context}:`, error.message);
  return errorResponse(500, "Erro ao acessar o banco de dados.");
}
