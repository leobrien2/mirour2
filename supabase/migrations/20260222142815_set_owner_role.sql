-- Update all existing admin_users to 'owner' role so they have full access.
-- The previous migration added the column with a default of 'staff', which hid the dashboard tabs for existing users.
UPDATE public.admin_users SET role = 'owner';
