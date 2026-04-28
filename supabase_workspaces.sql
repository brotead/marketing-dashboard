-- ============================================================
-- BROTE AD — Multi-Workspace Migration
-- Run this ONCE in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  owner_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add workspace_id to profiles (if not exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

-- 3. Add workspace_id to all data tables (nullable for backward compat)
ALTER TABLE public.budgets             ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);
ALTER TABLE public.goals               ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);
ALTER TABLE public.onboarding_clients  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);
ALTER TABLE public.tasks               ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);
ALTER TABLE public.changelog           ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

-- 4. Create fdiaz's default workspace and tag ALL existing data
DO $$
DECLARE
  fdiaz_user_id UUID;
  fdiaz_ws_id   UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO fdiaz_user_id FROM auth.users WHERE email = 'fdiaz@brotead.com';

  INSERT INTO public.workspaces (id, name, owner_id)
  VALUES (fdiaz_ws_id, 'Brote AD', fdiaz_user_id)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles          SET workspace_id = fdiaz_ws_id WHERE email = 'fdiaz@brotead.com';

  -- Tag all untagged existing data with fdiaz's workspace
  UPDATE public.budgets            SET workspace_id = fdiaz_ws_id WHERE workspace_id IS NULL;
  UPDATE public.goals              SET workspace_id = fdiaz_ws_id WHERE workspace_id IS NULL;
  UPDATE public.onboarding_clients SET workspace_id = fdiaz_ws_id WHERE workspace_id IS NULL;
  UPDATE public.tasks              SET workspace_id = fdiaz_ws_id WHERE workspace_id IS NULL;
  UPDATE public.changelog          SET workspace_id = fdiaz_ws_id WHERE workspace_id IS NULL;
END $$;

-- 5. Update signup trigger: auto-create workspace + skip role picker
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_ws_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Create a private workspace for the new user
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (user_name, NEW.id)
  RETURNING id INTO new_ws_id;

  -- Create profile: editor role, role_selected=true (skip role picker), workspace assigned
  INSERT INTO public.profiles (id, email, name, avatar_url, role, role_selected, workspace_id)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    NEW.raw_user_meta_data->>'avatar_url',
    'editor',
    true,
    new_ws_id
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate trigger (in case it already existed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RLS for workspaces table
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own workspace" ON public.workspaces;
CREATE POLICY "Users see own workspace" ON public.workspaces
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT workspace_id FROM public.profiles WHERE id = auth.uid())
  );
