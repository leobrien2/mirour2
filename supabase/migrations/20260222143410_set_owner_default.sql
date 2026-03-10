-- Change the default value of the role column in admin_users to 'owner'
ALTER TABLE public.admin_users ALTER COLUMN role SET DEFAULT 'owner';
