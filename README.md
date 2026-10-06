# NutriVision

Aplicação web mobile-first que usa IA (Claude Opus 5.5, da Anthropic) para analisar fotos de refeições e estimar calorias e macronutrientes automaticamente. Suporta múltiplas fotos por refeição, metas nutricionais personalizadas, histórico com gráficos e edição manual dos resultados.

## Funcionalidades

- **Análise por IA** — tire até 5 fotos de uma refeição e receba estimativa de calorias, proteínas, carboidratos, gordura e fibras
- **Metas personalizadas** — configure peso, altura, idade, sexo e objetivo; as metas são calculadas via fórmula Mifflin-St Jeor
- **Histórico com gráficos** — visualize calorias e macros dos últimos 7 ou 30 dias
- **Edição manual** — corrija qualquer resultado da IA diretamente no histórico
- **Câmera e galeria** — captura via câmera do dispositivo ou upload de arquivo

## Pré-requisitos

- **Node.js** 18 ou superior
- **npm** 9 ou superior
- **Chave de API da Anthropic** (`ANTHROPIC_API_KEY`) com acesso ao modelo `claude-opus-5-5`

## Instalação

```bash
# 1. Clone o repositório
git clone <url-do-repositorio>
cd visão

# 2. Instale as dependências
npm install

# 3. Configure a variável de ambiente
cp .env.example .env
# Edite o arquivo .env e adicione sua chave:
# ANTHROPIC_API_KEY=sk-ant-...
```

> **Nota:** se não houver `.env.example`, crie um arquivo `.env` na raiz com o conteúdo abaixo:
>
> ```env
> ANTHROPIC_API_KEY=sk-ant-sua-chave-aqui
> ```

## Rodando em desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

A câmera só funciona em contexto seguro — `localhost` já é aceito. Em rede local (ex: `192.168.x.x`), configure HTTPS ou use a opção de upload de arquivo.

## Build de produção

```bash
npm run build
npm start
```

## Estrutura do projeto

```
visão/
├── app/
│   ├── page.tsx                        # Página principal (abas: Diário, Histórico, Perfil)
│   ├── layout.tsx                      # Layout raiz com cabeçalho
│   ├── api/
│   │   ├── analyze-food/route.ts       # POST — análise de imagem via Claude
│   │   ├── meals/
│   │   │   ├── route.ts                # GET / DELETE / PATCH — histórico de refeições
│   │   │   └── stats/route.ts          # GET — agregação diária para gráficos
│   │   └── profile/route.ts            # GET / PUT — perfil e metas do usuário
│   └── components/features/
│       ├── camera-input.tsx            # Captura multi-foto (câmera + galeria)
│       ├── nutrition-card.tsx          # Card de resultado da análise
│       ├── meal-history.tsx            # Lista de refeições com edição inline
│       ├── nutrition-charts.tsx        # Gráficos de calorias e macros (Recharts)
│       └── profile-form.tsx            # Formulário de perfil com preview de metas
├── lib/
│   ├── db.ts                           # Inicialização do SQLite (better-sqlite3)
│   ├── nutrition.ts                    # Cálculo de metas (Mifflin-St Jeor)
│   └── utils.ts                        # Helper cn() para classes Tailwind
├── types/index.ts                      # Interfaces TypeScript
└── data/                               # Banco de dados SQLite (gerado automaticamente)
```

## Banco de dados

O banco SQLite é criado automaticamente em `data/nutrivision.db` na primeira execução. Nenhuma configuração adicional é necessária.

**Tabelas:**

| Tabela | Descrição |
|---|---|
| `meals` | Refeições registradas com macros, imagem thumbnail e flag de edição |
| `user_profile` | Perfil único do usuário (peso, altura, idade, sexo, objetivo) |

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sim | Chave da API da Anthropic |
| `ANTHROPIC_MODEL` | Não | Modelo usado na análise (padrão: `claude-opus-5-5`) |

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS |
| IA | Claude Opus 5.5 via SDK oficial da Anthropic (`@anthropic-ai/sdk`) |
| Banco | SQLite (`better-sqlite3`) |
| Imagens | `sharp` (resize de thumbnails) |
| Gráficos | Recharts |
| Validação | Zod |
| Ícones | Lucide React |

## API interna

### `POST /api/analyze-food`
Analisa uma ou mais imagens e salva a refeição.

```json
// Request
{ "images": ["data:image/jpeg;base64,..."] }

// Response
{
  "food_name": "Arroz com frango",
  "calories": 520,
  "macros": { "protein": 38, "carbs": 60, "fat": 12, "fiber": 3 },
  "confidence": "high",
  "explanation": "Refeição equilibrada com boa fonte de proteína magra."
}
```

### `GET /api/meals`
Retorna todas as refeições ordenadas por data.

### `PATCH /api/meals`
Atualiza valores de uma refeição e marca como editada manualmente.

### `DELETE /api/meals`
Remove uma refeição pelo `id`.

### `GET /api/meals/stats?days=7`
Retorna agregação diária de calorias e macros. Aceita `days=7` ou `days=30`.

### `GET /api/profile`
Retorna o perfil do usuário com metas calculadas.

### `PUT /api/profile`
Salva ou atualiza o perfil do usuário.
