-- ============================================================
-- BROTE AD — Auth & Roles Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'reader'
                  CHECK (role IN ('editor', 'reader', 'super_admin')),
  active        BOOLEAN NOT NULL DEFAULT true,
  role_selected BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, role, role_selected)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    'reader',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Row-Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read all profiles
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Service role bypasses RLS (for admin operations via server-side)
-- (service_role already bypasses RLS by default)

-- 4. Promote your account to super_admin
-- Run AFTER you've logged in for the first time so the row exists
UPDATE public.profiles
SET role = 'super_admin', role_selected = true
WHERE email = 'fdiaz@brotead.com';

-- ============================================================
-- OPTIONAL: If you want to restrict who can sign up,
-- disable email signups in Supabase Auth settings and
-- only allow Google OAuth. Then manage access via this table.
-- ============================================================
