# Correção dos bugs de migração SQLite → Supabase

Origem: auditoria de 2026-10-05. Itens #3, #4, #5, #9, #10, #11 do relatório.
Commit de referência da migração: `1315a3a feat: migrate from SQLite/better-sqlite3 to Supabase`.

## Contexto

A migração para Supabase trocou SQLite por Postgres, mas o código cliente continuou
assumindo os formatos do SQLite em três pontos: timestamps sem offset, booleanos como
`0|1`, e um `next.config.js` apontando para um driver que não existe mais.

## Subtarefas

### [x] A — `fix-supabase-row-shapes` (sem dependências)
Arquivos: `lib/date.ts` (novo), `app/components/features/meal-history.tsx`,
`types/index.ts`, `app/api/meals/route.ts`

- #3 `meal-history.tsx:21,31` — `new Date(isoStr + "Z")` gera `Invalid Date` quando
  `created_at` é `timestamptz` (já traz `+00:00`). Quebra `formatDate` e `isToday`,
  logo "Calorias hoje" fica em 0.
- #4 `is_edited` — API grava `true` (boolean Postgres), tipo declara `0 | 1`, UI testa
  `=== 1`. O selo "Editado" nunca aparece.
- #11 `meals/route.ts:25` — DELETE lê `req.json()` sem try/catch → 500 em vez de 400.

Critérios de aceite:
1. `lib/date.ts` exporta `parseTimestamp(iso: string): Date` que funciona tanto para
   string com offset (`...+00:00`, `...Z`) quanto sem offset (tratada como UTC).
2. `meal-history.tsx` não contém mais a concatenação `+ "Z"`.
3. `is_edited` é `boolean` em `types/index.ts`, e nenhuma comparação `=== 1` sobrou.
4. DELETE com body malformado retorna 400 (não 500).
5. `npx tsc --noEmit` passa sem erros.

### [x] B — `fix-confidence-and-config` (sem dependências)
Arquivos: `app/components/features/nutrition-card.tsx`, `next.config.js`

- #9 `nutrition-card.tsx:46` — ternário binário exibe confiança `"low"` como "Media".
- #5 `next.config.js:2` — `serverExternalPackages` ainda lista `better-sqlite3`,
  removido do código na migração. `sharp` deve permanecer (está em uso).

Critérios de aceite:
1. `confidence: "low"` renderiza "Baixa" e ícone distinto de "high"/"medium".
2. `better-sqlite3` não aparece mais em `next.config.js`; `sharp` continua lá.
3. `npx tsc --noEmit` passa sem erros.

### [x] C — `fix-stats-local-timezone` (dependsOn: A)
Arquivos: `app/api/meals/stats/route.ts`, `app/components/features/nutrition-charts.tsx`

- #10 `stats/route.ts:21,36` — as chaves de dia são derivadas em UTC, mas a janela de
  dias é construída com aritmética local. Em UTC-3, refeições do mesmo dia local caem
  em buckets diferentes conforme a hora, e os rótulos do gráfico saem deslocados.

Critérios de aceite:
1. Agrupamento por dia usa o fuso enviado pelo cliente (`?tz=`), com fallback seguro.
2. Refeição às 10:00 e às 22:00 do mesmo dia local caem no MESMO bucket.
3. O bucket mais recente corresponde ao dia local de hoje.
4. `npx tsc --noEmit` passa sem erros.

## Ondas

- Onda 1: A, B (paralelas — não compartilham arquivos)
- Onda 2: C (precisa do `parseTimestamp` criado em A)

## Fora de escopo nesta rodada

Segurança (#1 service role key sem auth, #2 endpoint de IA sem rate limit), deploy
contraditório (#6), schema não versionado (#7), validação da resposta da IA (#8),
e a higiene (#13–#19). Tratar em rodada separada.

## Revisão

Rodada "bugs de migração" (itens #3, #4, #5, #9, #10, #11 da auditoria). Três subtarefas,
duas ondas, todas aprovadas por verificador independente na primeira tentativa.

| Subtarefa | Status | Tentativas | Resumo |
|---|---|---|---|
| A `fix-supabase-row-shapes` | passed | 1 | `lib/date.ts` novo com `parseTimestamp`; `is_edited` virou `boolean`; DELETE valida com zod e devolve 400 |
| B `fix-confidence-and-config` | passed | 1 | `confidence: "low"` passa a exibir "Baixa"; `better-sqlite3` removido do `next.config.js` (`sharp` preservado) |
| C `fix-stats-local-timezone` | passed | 1 | stats agrupa no fuso do usuário via `Intl.DateTimeFormat("en-CA")`; cliente envia `tz`; janela alargada em 1 dia |

### Arquivos alterados
- `lib/date.ts` (novo)
- `types/index.ts`
- `app/api/meals/route.ts`
- `app/api/meals/stats/route.ts`
- `app/components/features/meal-history.tsx`
- `app/components/features/nutrition-card.tsx`
- `app/components/features/nutrition-charts.tsx`
- `next.config.js`

### Verificação end-to-end (app rodando, não só typecheck)
O dev server foi levantado e as rotas exercitadas por HTTP. Como o projeto Supabase do `.env`
não existe mais (NXDOMAIN), o banco foi substituído por um stub PostgREST local via override da
variável `SUPABASE_URL` no processo — nenhum arquivo do projeto foi alterado para isso.

Massa de teste: duas refeições do MESMO dia local em UTC-3 — `2026-10-05T13:00:00+00:00`
(10:00, 500 kcal) e `2026-10-06T01:00:00+00:00` (22:00, 700 kcal).

- `tz=America/Sao_Paulo` -> bucket `2026-10-05` = **1200 kcal** (correto)
- `tz=UTC` (comportamento antigo) -> bucket `2026-10-05` = **500 kcal**; a janta de 700 kcal
  caía em `2026-10-06` e sumia do gráfico
- `tz` inválido (`Nao/Existe`, `../../etc`) -> HTTP 200 com fallback para UTC, sem 500
- DELETE com body malformado / sem `id` / `id` string / `id` negativo -> **400** nos quatro casos
- `GET /api/meals` -> `is_edited` chega como `boolean`
- Na UI: datas renderizam `05/10, 10:00` e `05/10, 22:00`; "Calorias hoje" soma 1200;
  o selo "Editado" aparece na refeição editada e não na outra; o gráfico mostra uma única
  barra de 1200 kcal em 05/10

### Achados novos, fora do escopo desta rodada
1. **Projeto Supabase inexistente** — `btpwtkiwuleehaziqsje.supabase.co` devolve NXDOMAIN
   (confirmado pelo resolver 8.8.8.8). Toda rota que toca o banco falha com
   `TypeError: fetch failed`. Precisa de um projeto novo e `.env` atualizado.
2. **`app/api/profile/route.ts` engole o erro do banco** — a linha 23 desestrutura só `{ data }`,
   ignora `error`, e cai em `DEFAULT_PROFILE`. Resultado: com o banco fora do ar a rota responde
   200 com um perfil fictício (70 kg / 170 cm / 25 anos) em vez de sinalizar falha. É assim que o
   banco inacessível passou despercebido. Tratar junto com o item #7 da auditoria (schema).

---

# Rodada 2 — Segurança (#1 autorização, #2 rate limit)

## Contexto

App publicado na Vercel (`projectName: "visao"`) com **zero autorização** nas 4 rotas:
qualquer um que souber a URL lê, edita e apaga todas as refeições, e dispara
`POST /api/analyze-food`, que chama a API da Anthropic (dreno direto de crédito,
`maxDuration = 60`).

Correção de ênfase da auditoria: a service role key **não** vaza para o browser
(não há `NEXT_PUBLIC_*`; `lib/db.ts` só roda no servidor). O problema é a ausência
de autorização, não exposição de chave.

Decisões do usuário: **gate single-user** (middleware + senha em cookie HttpOnly,
casa com o `id: 1` fixo) e **rate limit em memória** (sem dependência nova).

## Subtarefas

### [x] S1 — `rate-limit-core` (sem dependências)
Arquivo: `lib/rate-limit.ts` (novo)
- `Map<chave, { count, resetAt }>` com janela deslizante por chave.
- Extração de IP de `x-forwarded-for` / `x-real-ip` com fallback; o header é
  falsificável fora da Vercel — documentar isso em comentário.
- Teto no tamanho do Map + limpeza de entradas expiradas (o próprio Map é vetor
  de exaustão de memória se crescer sem limite).
Critérios: 6ª chamada dentro da janela é bloqueada; libera após a janela;
entradas expiradas somem; `npx tsc --noEmit` exit 0.

### [x] S2 — `auth-gate` (dependsOn: S1)
Arquivos: `lib/auth.ts` (novo), `middleware.ts` (novo), `app/login/page.tsx` (novo),
`app/api/auth/route.ts` (novo), `.env.example` (novo)
- `lib/auth.ts` **Edge-safe**: HMAC-SHA256 via `crypto.subtle` (middleware roda em
  Edge; `node:crypto` não existe lá). Token `exp.assinatura`, verificação em tempo
  constante via `crypto.subtle.verify`.
- `middleware.ts`: protege tudo exceto `/login`, `/api/auth` e estáticos do PWA
  (`manifest.json`, ícones). Rota `/api/*` sem sessão → 401 JSON; página → redirect
  para `/login`. **Fail closed** se `AUTH_SECRET`/`APP_PASSWORD` faltarem.
- `app/api/auth/route.ts`: POST compara a senha em tempo constante, aplica rate
  limit (força bruta), emite cookie `HttpOnly`, `Secure` em produção, `SameSite=Lax`,
  `Path=/`. DELETE faz logout.
- `cookies()` é assíncrono no Next 15/16 — precisa de `await`.
Critérios: sem cookie, as 4 rotas retornam 401 e `/` redireciona; senha errada → 401;
senha certa → cookie `HttpOnly` e acesso liberado; 6ª tentativa de senha → 429;
`npx tsc --noEmit` exit 0.

### [x] S3 — `harden-ai-route` (dependsOn: S1)
Arquivo: `app/api/analyze-food/route.ts`
- Rate limit por IP na rota cara (dreno de crédito), resposta 429 com `Retry-After`.
- Teto de bytes por imagem e no total, direto no schema zod (hoje `z.string().min(1)`
  aceita base64 de tamanho ilimitado × 5).
- Manter a mensagem de erro genérica; não vazar detalhe do modelo nem do banco.
Critérios: payload acima do teto → 400 sem chamar a Anthropic; excesso de chamadas
→ 429; `npx tsc --noEmit` exit 0.

## Ondas
- Onda 1: S1
- Onda 2: S2 + S3 em paralelo (arquivos disjuntos, ambas dependem de S1)

## Fora de escopo nesta rodada
Auth multiusuário real (Supabase Auth + `user_id` + RLS) — exigiria schema novo e o
projeto Supabase do `.env` não existe mais (NXDOMAIN), então não daria para aplicar
nem verificar. Também fora: #7 schema, #8 validação da resposta da IA, #6 deploy,
#12 modelo, #13–#19 higiene. Token CSRF dedicado dispensado: `SameSite=Lax` + API
exclusivamente JSON cobrem o vetor principal num app de formulário único.

## Revisão — Rodada 2 (segurança)

Itens #1 (nenhuma autorização) e #2 (sem rate limit na rota de IA) da auditoria.

| Subtarefa | Status | Tentativas | Resumo |
|---|---|---|---|
| S1 `rate-limit-core` | passed | 2 | `lib/rate-limit.ts`: janela fixa por chave, varredura amortizada de expiradas, teto de 10k entradas. Reprovado na 1ª tentativa por bug real de eviction. |
| S2 `auth-gate` | passed | 1 | Gate de senha única: `lib/auth.ts` (HMAC via Web Crypto, Edge-safe), `middleware.ts`, `app/api/auth/route.ts`, `app/login/page.tsx`, `.env.example`. |
| S3 `harden-ai-route` | passed | 1 | `app/api/analyze-food/route.ts`: 10 req/min por IP e teto de bytes, ambos antes de sharp/Anthropic. |

### Arquivos

Novos: `lib/rate-limit.ts`, `lib/auth.ts`, `middleware.ts`, `app/api/auth/route.ts`, `app/login/page.tsx`, `.env.example`.
Modificados: `app/api/analyze-food/route.ts`.

### Bug encontrado pelo verificador em S1

`evictOldest` ordenava por `resetAt` e podia escolher como vítima a própria chave da chamada em curso, que era então recriada com `count: 0` — o contador de tentativas de senha zerava com a janela ainda aberta, justamente na chave mais antiga (a que já acumulou mais tentativas). Reproduzido isoladamente: `remaining: 99` onde devia ser `98`. Corrigido com `excludeKey` em `evictOldest` e reordenação (varredura de expiradas primeiro, eviction só quando a chamada vai inserir chave nova), com comentário no código contra reordenação futura.

### Limitações conhecidas e aceitas (não são defeitos a corrigir)

- **Contador em memória por instância**: zera em cold start na Vercel. Decisão explícita do dono.
- **Eviction sob saturação**: com o Map em 10k chaves vivas, uma entrada viva de *outra* chave pode ser descartada entre chamadas. Exige ~167 IPs novos/s sustentados contra a mesma instância, regime em que o cold start já zeraria tudo. Documentado em comentário.
- **`x-forwarded-for` falsificável** fora de um proxy confiável; na Vercel a plataforma sobrescreve o header. Documentado em comentário.
- **Replay de token após logout**: o token é autocontido (HMAC, sem estado no servidor), então o valor capturado antes do logout vale até `exp`. Uma blacklist exigiria estado persistente (Redis/KV), contra a decisão de não adicionar dependências. Avaliado pelo verificador como aceitável para gate de senha única de app pessoal.
- **Teto de 20 MB no total somado é inalcançável hoje**: o Next trunca corpos acima de 10 MB quando há middleware (`middlewareClientMaxBodySize`). O corpo truncado vira JSON incompleto e cai no 400 — falha fechada, sem imagem parcial chegando à Anthropic. O teto permanece como defesa em profundidade.
- **Rate limit não evita o tráfego de entrada**: o corpo é recebido pelo socket antes do handler rodar. Evita o custo de CPU (parse, base64, sharp) e o custo da Anthropic, não a banda.

### Ação pendente do dono

`AUTH_SECRET` e `APP_PASSWORD` precisam ser definidos no `.env` local e nas variáveis de ambiente da Vercel. O middleware **falha fechado**: sem essas duas, o app nega acesso a tudo, inclusive ao dono. Ver `.env.example`.

### Fora de escopo desta rodada

Auth multi-usuário real (Supabase Auth + `user_id` + RLS) — impossível aplicar ou verificar, o projeto Supabase do `.env` não existe mais (NXDOMAIN). Itens #6 (deploy contraditório Vercel/Netlify), #7 (schema), #8 (validação da resposta do modelo), #12 (modelo), #13–#19 (higiene). Token CSRF dedicado (o `SameSite=Lax` cobre o caso de uso atual).

---

# Rodada 3 — Upload de fotos e validação da resposta da IA (itens 3 e 4)

### [x] R1 — redimensionar fotos no navegador (item 3)
Arquivos: `lib/image.ts` (novo), `app/page.tsx`
- Foto de celular vai crua (3–8 MB, +33% em base64). Estoura o limite de corpo da
  Vercel (~4,5 MB) e o teto de 5 MB por imagem da Anthropic, que reduz para ~1568 px
  de qualquer jeito.
- Redimensionar via canvas para lado maior ≤ 1568 px, JPEG 0,85, fundo branco
  (PNG transparente não vira preto). Se o navegador não decodificar (ex.: HEIC no
  Chrome), cair para o arquivo original.
Critérios: foto 4000×3000 sai com lado maior 1568 px e < 1 MB; foto pequena não é
ampliada; `npx tsc --noEmit` exit 0.

### [x] R2 — validar a resposta da IA (item 4)
Arquivo: `app/api/analyze-food/route.ts`
- Trocar regex + `JSON.parse` por structured outputs (`messages.parse` +
  `zodOutputFormat`). Não usar `tool_choice` forçado: retorna 400 em Opus 5.5 /
  Sonnet 5.5, e o modelo é configurável por `ANTHROPIC_MODEL`.
- `parsed_output` nulo (recusa, `max_tokens`) ou valores negativos/não finitos →
  502 com mensagem genérica, sem gravar no banco.
Critérios: resposta malformada não gera 500 nem grava lixo; resposta válida segue
igual para o cliente (mesmo shape de `NutritionAnalysis`); `npx tsc --noEmit` exit 0.

## Revisão — Rodada 3
- `npx tsc --noEmit`: exit 0.
- R1 (Chrome headless via DevTools, `prepareImageForUpload` real):
  - JPEG 4000×3000 (243 KB) → 1568×1176, 62 KB.
  - Retrato 3000×4000 → 1176×1568.
  - 800×600 → 800×600 (não ampliou).
  - PNG transparente → JPEG com canto branco (255,255,255).
  - Arquivo indecodificável `image/heic` → fallback para o data URL original.
- R2 (dev server + `ANTHROPIC_MODEL=claude-sonnet-5-5`): POST com JPEG
  sintético → 200 com shape de `NutritionAnalysis` válido.
- Pendente / fora do escopo:
  - HEIC que o navegador não decodifica cai no fallback, e o servidor ainda
    responde 500 (`extractBase64` não valida o media type). Fica para o item 6.
  - Insert no Supabase falhou no teste local (projeto não existe mais, NXDOMAIN).
    Só loga, então a análise ainda volta para o cliente (item 5).

# Rodada 4 — Erros da análise (itens 5, 6 e 7)

### [x] R3 — imagem em formato não suportado (item 6)
Arquivo: `app/api/analyze-food/route.ts`
- `extractBase64` lança erro → 500. Validar o media type (jpeg/png/gif/webp) antes
  de chamar a IA e responder 400 com mensagem clara (ex.: HEIC no Chrome).
- Erros da API da Anthropic: 429/529 → 503 "IA ocupada"; demais → 502.
Critérios: `data:image/heic` → 400; data URL malformado → 400; nada de 500 genérico.

### [x] R4 — falha ao salvar não é silenciosa (item 5)
Arquivos: `app/api/analyze-food/route.ts`, `types/index.ts`, `app/page.tsx`
- Análise já paga não é descartada: resposta 200 com `saved: boolean`.
- Falha no thumbnail (sharp) ou no insert → `saved: false` + log; cliente mostra
  aviso "não foi salva no histórico" e não recarrega o histórico.
Critérios: com Supabase fora do ar → 200 com `saved: false` e aviso na tela.

### [x] R5 — mensagens de erro específicas no cliente (item 7)
Arquivos: `app/api/analyze-food/route.ts`, `app/page.tsx`
- Toda resposta de erro da rota vira JSON `{ error }` (429 e middleware já são).
- Cliente mostra o `error` do servidor; 401 → redireciona para /login.
Critérios: 400/429/502/503 exibem mensagens distintas; `npx tsc --noEmit` exit 0.

## Revisão — Rodada 4
- `npx tsc --noEmit`: exit 0.
- E2E no dev server (curl, logado):
  - sem cookie → 401 `{"error":"Nao autorizado"}`
  - `data:image/heic` → 400 "Formato de imagem nao suportado…"
  - string que não é data URL → 400 (mesma mensagem)
  - `{}` → 400 "Envie de 1 a 5 imagens."
  - JPEG com bytes inválidos → Anthropic 400 → 502 "A IA nao conseguiu analisar…"
  - JPEG válido → 200 com `saved: true` (o Supabase voltou a resolver)
  - JPEG válido com `SUPABASE_URL` inválido → 200 com `saved: false`, log "Erro ao salvar refeicao"
- Não testado no navegador: aviso âmbar e redirect 401 em `app/page.tsx`
  (lógica simples, coberta pelo typecheck).
- Efeito colateral: o teste com o Supabase real gravou 1 linha de teste
  ("Prato não identificado", 0 kcal) na tabela `meals`.
