-- Add notes column to responses table for responder notes
ALTER TABLE public.responses 
ADD COLUMN notes TEXT DEFAULT NULL;