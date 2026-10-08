-- Schema do banco (Supabase/Postgres).
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- O app acessa via SUPABASE_SERVICE_ROLE_KEY, que ignora RLS. O RLS fica ligado
-- sem políticas para bloquear qualquer acesso pela chave pública (anon).

create table if not exists public.meals (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  food_name    text        not null,
  -- numeric: a IA pode devolver valores fracionados (ex.: 450.5)
  calories     numeric     not null default 0,
  protein      numeric     not null default 0,
  carbs        numeric     not null default 0,
  fat          numeric     not null default 0,
  fiber        numeric     not null default 0,
  confidence   text        check (confidence in ('high', 'medium', 'low')),
  explanation  text,
  image_base64 text,
  is_edited    boolean     not null default false
);

-- /api/meals ordena e /api/meals/stats filtra por created_at
create index if not exists meals_created_at_idx on public.meals (created_at desc);

-- Perfil único (o app sempre usa id = 1)
create table if not exists public.user_profile (
  id         integer     primary key default 1 check (id = 1),
  weight_kg  numeric     not null,
  height_cm  numeric     not null,
  age        integer     not null check (age between 1 and 120),
  sex        text        not null check (sex in ('male', 'female')),
  goal       text        not null check (goal in ('lose_weight', 'maintain', 'gain_muscle')),
  updated_at timestamptz not null default now()
);

alter table public.meals        enable row level security;
alter table public.user_profile enable row level security;
