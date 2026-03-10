-- Add customer_id to responses table
ALTER TABLE public.responses 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Add customer_id to flow_sessions table
ALTER TABLE public.flow_sessions 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_responses_customer_id ON public.responses(customer_id);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_customer_id ON public.flow_sessions(customer_id);
