-- Run this in Supabase Dashboard → SQL Editor
-- Stores campaigns manually deleted by users so the hourly sync never re-adds them

CREATE TABLE IF NOT EXISTS public.excluded_campaigns (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id          TEXT        NOT NULL,
  source              TEXT        NOT NULL,
  campaign_name       TEXT        NOT NULL,
  campaign_name_norm  TEXT        NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, account_id, source, campaign_name_norm)
);

ALTER TABLE public.excluded_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members access excluded campaigns" ON public.excluded_campaigns;
CREATE POLICY "Workspace members access excluded campaigns"
  ON public.excluded_campaigns FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT workspace_id FROM public.profiles WHERE id = auth.uid())
  );
