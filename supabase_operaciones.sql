-- Sección Operaciones: Tareas + Bitácora de cambios + override de gasto
-- Ejecutar en Supabase SQL Editor

-- Override de gasto manual por campaña (prioridad sobre Windsor)
alter table budgets add column if not exists spend_override numeric default null;

create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  client_name text not null,
  title       text not null,
  priority    text not null default 'normal',   -- 'alta' | 'normal' | 'baja'
  status      text not null default 'pendiente', -- 'pendiente' | 'en_progreso' | 'hecho'
  due_date    date,
  created_at  timestamptz default now()
);

create table if not exists changelog (
  id          uuid primary key default gen_random_uuid(),
  client_name text not null,
  change_type text not null, -- 'presupuesto' | 'segmentacion' | 'creatividad' | 'campaña' | 'pausa' | 'audiencia' | 'otro'
  description text not null,
  created_at  timestamptz default now()
);
