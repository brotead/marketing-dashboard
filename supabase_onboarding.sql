-- Onboarding Clientes – Paid Media
-- Ejecutar en Supabase SQL Editor

create table if not exists onboarding_clients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  platform         text not null default 'meta',   -- 'meta' | 'google' | 'both'
  website          text,
  checklist        jsonb not null default '{}',    -- { key: boolean }
  analysis         jsonb,
  analysis_status  text not null default 'none',   -- 'none' | 'running' | 'done' | 'error'
  created_at       timestamptz default now()
);
