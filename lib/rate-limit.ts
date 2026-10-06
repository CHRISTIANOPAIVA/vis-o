// lib/rate-limit.ts
//
// Limitador de taxa em memoria, sem dependencias externas (sem Redis/Upstash).
// Decisao de arquitetura deliberada: o app roda serverless na Vercel, entao
// este contador vive por instancia e zera em cold start / reload de modulo
// em dev. Isso e aceito e conhecido - nao e um bug a corrigir.

export type RateLimitResult = {
  ok: boolean; // false => estourou o limite
  remaining: number; // chamadas restantes na janela
  retryAfterSeconds: number; // 0 quando ok === true
};

type Entry = {
  count: number;
  resetAt: number; // epoch ms em que a janela atual termina
};

// Estado no escopo do modulo (sobrevive entre requests na mesma instancia).
const store = new Map<string, Entry>();

// Teto absoluto de entradas. Sem isso, um atacante que varia o IP de origem
// a cada request faz o Map crescer sem limite ate esgotar a memoria do
// processo - o proprio rate limiter se tornaria o vetor de DoS.
const MAX_ENTRIES = 10_000;

// A limpeza de entradas expiradas e amortizada: so roda a cada N chamadas,
// nunca via setInterval/setTimeout de modulo (um timer pendurado atrapalha
// o encerramento de uma function serverless e nao tem por que existir
// quando ninguem esta chamando rateLimit).
const SWEEP_EVERY = 100;
let callsSinceSweep = 0;

function sweepExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

// Quando o teto e atingido mesmo apos remover expiradas, descarta as
// entradas mais antigas (menor resetAt) para abrir espaço. Garante que o
// Map nunca cresça alem do teto, mesmo sob um ataque com muitos IPs.
// Limitacao conhecida e aceita: sob saturacao do teto, uma entrada VIVA de
// outra chave pode ser descartada aqui (entre chamadas), reiniciando o
// contador dela antes do fim da janela. Isso exige ~10.000 chaves distintas
// vivas na mesma janela contra a mesma instancia; nesse regime o contador ja
// zeraria por cold start de qualquer forma. A garantia absoluta e outra: a
// chave da chamada atual nunca e auto-evictada (ver `excludeKey`).
// `excludeKey` nunca pode ser escolhida como vitima: e a chave que a
// chamada atual esta tentando usar, e descarta-la aqui reabriria o bug
// de reset silencioso de contador (ver comentario em rateLimit).
function evictOldest(count: number, excludeKey: string): void {
  const victims = [...store.entries()]
    .filter(([key]) => key !== excludeKey)
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, count);
  for (const [key] of victims) {
    store.delete(key);
  }
}

/**
 * Janela fixa por chave. A primeira chamada abre a janela; chamadas
 * seguintes dentro dela incrementam o contador. Passada a janela, a chave
 * recomeca do zero.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // 1) Varredura amortizada de expiradas. E sempre segura de rodar em
  // qualquer ordem: so remove entradas cujo resetAt ja passou, nunca a
  // entrada que esta chamada esta tentando usar (se ainda nao expirou).
  callsSinceSweep++;
  if (callsSinceSweep >= SWEEP_EVERY || store.size >= MAX_ENTRIES) {
    callsSinceSweep = 0;
    sweepExpired(now);
  }

  // 2) So DEPOIS da varredura (quando o Map ja esta livre de lixo
  // expirado) decidimos se e preciso abrir espaço - e so verificamos
  // isso se `key` ainda NAO esta no Map. Se a chave ja existe, esta
  // chamada vai reaproveitar o slot dela, nao criar um novo; logo nao ha
  // motivo (nem permissao) para despejar ninguem. ORDEM CRITICA: checar
  // a existencia de `key` ANTES de evictar foi exatamente o bug corrigido
  // aqui - com o Map no teto, a propria `key` costuma ter o menor
  // resetAt (e a mais usada/atacada) e acabava sendo a vitima preferida
  // da eviction, resetando seu contador sem a janela ter realmente virado.
  // Nao reordene isto sem preservar essa garantia.
  if (!store.has(key) && store.size >= MAX_ENTRIES) {
    const overflow = store.size - MAX_ENTRIES + 1;
    evictOldest(overflow, key);
  }

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > limit) {
    const retryAfterSeconds = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  return {
    ok: true,
    remaining: limit - entry.count,
    retryAfterSeconds: 0,
  };
}

const FALLBACK_KEY = "unknown";

/**
 * Deriva uma chave de identificacao do cliente a partir do IP.
 *
 * Aviso honesto: `x-forwarded-for` e `x-real-ip` sao headers HTTP comuns,
 * portanto falsificaveis por qualquer cliente quando a app nao esta atras
 * de um proxy confiavel que os sobrescreva. Na Vercel, esses headers sao
 * definidos pela propria plataforma (o proxy de borda), o que torna o
 * valor confiavel *naquele ambiente especifico* - mas isso nao e uma
 * identidade segura de forma geral, apenas o melhor sinal disponivel sem
 * autenticacao.
 */
export function clientKey(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  return FALLBACK_KEY;
}
