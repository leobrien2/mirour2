-- Add notes column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN notes TEXT DEFAULT NULL;