# NutriVision

Aplicação web mobile-first que usa IA (Claude, da Anthropic) para analisar fotos de refeições e estimar calorias e macronutrientes. Suporta múltiplas fotos por refeição, metas nutricionais personalizadas, histórico com gráficos e edição manual dos resultados. É um app pessoal de usuário único, protegido por senha.

## Funcionalidades

- **Análise por IA** — tire até 5 fotos de uma refeição e receba estimativa de calorias, proteínas, carboidratos, gordura e fibras
- **Metas personalizadas** — configure peso, altura, idade, sexo e objetivo; as metas são calculadas via fórmula Mifflin-St Jeor
- **Histórico com gráficos** — visualize calorias e macros dos últimos 7 ou 30 dias, no fuso do usuário
- **Edição manual** — corrija qualquer resultado da IA diretamente no histórico
- **Câmera e galeria** — captura via câmera do dispositivo ou upload de arquivo (fotos são reduzidas no navegador antes do envio)

## Pré-requisitos

- **Node.js** 20 ou superior
- **Chave de API da Anthropic**
- **Projeto Supabase** com o schema de [`supabase/schema.sql`](supabase/schema.sql) aplicado

## Instalação

```bash
npm install
cp .env.example .env   # preencha as variáveis (ver abaixo)
```

Aplique o schema no Supabase: cole o conteúdo de `supabase/schema.sql` no SQL Editor do projeto e execute.

## Rodando em desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) e entre com a senha definida em `APP_PASSWORD`.

A câmera só funciona em contexto seguro — `localhost` já é aceito. Em rede local (ex: `192.168.x.x`), configure HTTPS ou use a opção de upload de arquivo.

## Build de produção

```bash
npm run build
npm start
```

## Deploy

O app é publicado na Vercel. Todas as variáveis abaixo precisam estar configuradas no projeto da Vercel (Production e Preview); sem `AUTH_SECRET` e `APP_PASSWORD` o app nega acesso a tudo.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic |
| `ANTHROPIC_MODEL` | Modelo usado na análise (ex.: `claude-haiku-4-5`) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service-role do Supabase (só no servidor) |
| `AUTH_SECRET` | Segredo para assinar o cookie de sessão (`openssl rand -base64 32`) |
| `APP_PASSWORD` | Senha de acesso ao app |

## Estrutura do projeto

```
visão/
├── app/
│   ├── page.tsx                        # Página principal (abas: Diário, Histórico, Perfil)
│   ├── layout.tsx                      # Layout raiz com cabeçalho
│   ├── login/page.tsx                  # Tela de senha
│   ├── api/
│   │   ├── analyze-food/route.ts       # POST — análise de imagem via Claude
│   │   ├── auth/route.ts               # POST login / DELETE logout
│   │   ├── meals/
│   │   │   ├── route.ts                # GET / DELETE / PATCH — histórico de refeições
│   │   │   └── stats/route.ts          # GET — agregação diária para gráficos
│   │   └── profile/route.ts            # GET / PUT — perfil e metas do usuário
│   └── components/features/            # Câmera, card de resultado, histórico, gráficos, perfil
├── lib/
│   ├── api.ts                          # Respostas de erro padronizadas
│   ├── auth.ts                         # Token de sessão (HMAC via Web Crypto)
│   ├── date.ts                         # Parse de timestamps do Postgres
│   ├── db.ts                           # Cliente Supabase
│   ├── image.ts                        # Redimensionamento de fotos no navegador
│   ├── nutrition.ts                    # Cálculo de metas (Mifflin-St Jeor)
│   ├── rate-limit.ts                   # Rate limit em memória
│   └── utils.ts                        # Helper cn() para classes Tailwind
├── proxy.ts                            # Gate de autenticação (todas as rotas)
├── supabase/schema.sql                 # Schema do banco
└── types/index.ts                      # Interfaces TypeScript
```

## Banco de dados

Postgres no Supabase, com o schema versionado em [`supabase/schema.sql`](supabase/schema.sql).

| Tabela | Descrição |
|---|---|
| `meals` | Refeições registradas com macros, thumbnail e flag de edição |
| `user_profile` | Perfil único do usuário (peso, altura, idade, sexo, objetivo) |

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS |
| IA | Claude via `@anthropic-ai/sdk` (structured outputs) |
| Banco | Supabase (Postgres) |
| Imagens | `sharp` (thumbnails) |
| Gráficos | Recharts |
| Validação | Zod |
| Ícones | Lucide React |

## API interna

Todas as rotas, exceto `/api/auth`, exigem sessão (cookie emitido no login) e respondem `401` sem ela. Erros vêm no formato `{ "error": "..." }`.

### `POST /api/analyze-food`
Analisa de 1 a 5 imagens e salva a refeição. Limitado a 10 requisições por minuto por IP.

```json
// Request
{ "images": ["data:image/jpeg;base64,..."] }

// Response
{
  "food_name": "Arroz com frango",
  "calories": 520,
  "macros": { "protein": 38, "carbs": 60, "fat": 12, "fiber": 3 },
  "confidence": "high",
  "explanation": "Refeição equilibrada com boa fonte de proteína magra.",
  "saved": true
}
```

### `GET /api/meals?limit=30&before=<id>`
Retorna refeições paginadas, mais recentes primeiro: `{ meals, nextCursor }`.

### `PATCH /api/meals`
Atualiza valores de uma refeição e marca como editada manualmente.

### `DELETE /api/meals`
Remove uma refeição pelo `id`.

### `GET /api/meals/stats?days=7&tz=America/Sao_Paulo`
Retorna agregação diária de calorias e macros no fuso informado. Aceita `days=7` ou `days=30`.

### `GET /api/profile`
Retorna o perfil do usuário com metas calculadas.

### `PUT /api/profile`
Salva ou atualiza o perfil do usuário.
