-- Fix conflicting 'profiles' table issue

-- 1. Rename the original business owners table to admin_users
ALTER TABLE IF EXISTS public.profiles RENAME TO admin_users;

-- 2. Drop the foreign key from profile_rules if it was erroneously attached to admin_users
ALTER TABLE IF EXISTS public.profile_rules DROP CONSTRAINT IF EXISTS profile_rules_profile_id_fkey;

-- 3. Now create the intended consumer profiles table correctly
CREATE TABLE IF NOT EXISTS public.profiles (
  id           varchar PRIMARY KEY,
  display_name varchar NOT NULL,
  description  text,
  is_default   boolean DEFAULT false,
  zones        text[],
  created_at   timestamptz DEFAULT now()
);

-- 4. Re-attach the foreign key to the new correctly structured consumer profiles table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_rules') THEN
    ALTER TABLE public.profile_rules 
      ADD CONSTRAINT profile_rules_profile_id_fkey 
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- 5. Fix the trigger function for new user signups to point to admin_users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_users (id, business_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'business_name', 'My Business'));
  RETURN NEW;
END;
$$;

-- 6. Add the role column to admin_users since it was silently skipped before
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'staff';

-- 7. Add role check constraint
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_role_check') THEN
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN ('owner', 'staff'));
  END IF;
END $$;

-- 8. Enable RLS and re-create policies for admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.admin_users;
CREATE POLICY "Users can view their own profile"
ON public.admin_users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.admin_users;
CREATE POLICY "Users can update their own profile"
ON public.admin_users FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.admin_users;
CREATE POLICY "Users can insert their own profile"
ON public.admin_users FOR INSERT
WITH CHECK (auth.uid() = id);

-- 9. Consumer profiles need to be globally readable (for the quiz engine)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read consumer profiles" ON public.profiles;
CREATE POLICY "Anyone can read consumer profiles"
ON public.profiles FOR SELECT
USING (true);

-- 10. profile_rules needs to be globally readable
ALTER TABLE public.profile_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read profile rules" ON public.profile_rules;
CREATE POLICY "Anyone can read profile rules"
ON public.profile_rules FOR SELECT
USING (true);
