-- ============================================================
-- Client Configs — Responsable de pauta por cliente
-- Run once in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_configs (
  client_name  text        NOT NULL,
  workspace_id uuid        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  responsable  text,
  created_at   timestamptz DEFAULT NOW(),
  PRIMARY KEY (client_name, workspace_id)
);

-- RLS
ALTER TABLE public.client_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own workspace client configs" ON public.client_configs;
CREATE POLICY "Users see own workspace client configs"
  ON public.client_configs FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ── Datos iniciales ────────────────────────────────────────
-- Usa el workspace de fdiaz (Brote AD)
INSERT INTO public.client_configs (client_name, workspace_id, responsable)
SELECT c.client_name, w.id, 'Franco'
FROM (VALUES
  ('BB'), ('HSF'), ('MAFRALAC'), ('DURAPLAS'), ('FRUSSO'),
  ('AMIPACK'), ('EL REGI'), ('VIGOR'), ('PAPELTECNICA'), ('BROTE'),
  ('EVORA'), ('CHIALVO'), ('NUTRIAR'), ('AIRESHOW')
) AS c(client_name)
CROSS JOIN (SELECT id FROM public.workspaces WHERE name = 'Brote AD' LIMIT 1) AS w
ON CONFLICT (client_name, workspace_id) DO NOTHING;
