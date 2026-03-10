-- Function to safely merge customer traits (JSONB)
-- This allows us to accumulate tags/preferences over time instead of overwriting them.
-- Usage: SELECT merge_customer_traits('store_uuid', 'email@example.com', '{"tags": ["new_tag"]}'::jsonb);

CREATE OR REPLACE FUNCTION public.merge_customer_traits(
    p_store_id UUID,
    p_email TEXT,
    p_phone TEXT,
    p_name TEXT,
    p_new_traits JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_current_traits JSONB;
    v_merged_traits JSONB;
BEGIN
    -- 1. Try to find existing customer by email OR phone within this store
    SELECT id, traits INTO v_customer_id, v_current_traits
    FROM public.customers
    WHERE store_id = p_store_id
    AND (
        (p_email IS NOT NULL AND email = p_email)
        OR 
        (p_phone IS NOT NULL AND phone = p_phone)
    )
    LIMIT 1;

    -- 2. If customer exists, merge traits
    IF v_customer_id IS NOT NULL THEN
        -- Simple merge: Shallow merge of top-level keys. 
        -- For "tags" array, we want to combine unique values.
        
        -- Logic:
        -- A) Merge top-level keys (new overwrites old for scalars)
        -- B) Specifically handle 'tags' key to be a set union
        
        SELECT 
            jsonb_set(
                COALESCE(v_current_traits, '{}'::jsonb) || p_new_traits, -- Base merge
                '{tags}', -- Target path
                (
                    SELECT jsonb_agg(DISTINCT elem)
                    FROM (
                        SELECT jsonb_array_elements(COALESCE(v_current_traits->'tags', '[]'::jsonb)) AS elem
                        UNION
                        SELECT jsonb_array_elements(COALESCE(p_new_traits->'tags', '[]'::jsonb)) AS elem
                    ) t
                )
            )
        INTO v_merged_traits;

        -- Update the customer
        UPDATE public.customers
        SET 
            traits = v_merged_traits,
            name = COALESCE(p_name, name), -- Update name if provided
            email = COALESCE(p_email, email), -- Update identifiers if provided (and not conflicting)
            phone = COALESCE(p_phone, phone),
            updated_at = now()
        WHERE id = v_customer_id;
        
        RETURN v_customer_id;
    
    ELSE
        -- 3. If new customer, insert
        INSERT INTO public.customers (store_id, email, phone, name, traits)
        VALUES (p_store_id, p_email, p_phone, p_name, p_new_traits)
        RETURNING id INTO v_customer_id;
        
        RETURN v_customer_id;
    END IF;
END;
$$;
