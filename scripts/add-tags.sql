-- ========================================
-- ADD STORE AND 14 TAGS TO DATABASE
-- ========================================
-- This script will:
-- 1. Create a store (or use existing one)
-- 2. Add 14 comprehensive tags to that store
--
-- Run this in Supabase SQL Editor
-- ========================================

-- Step 1: Get or create a store
-- This will insert a store only if you don't have one already
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users

DO $$
DECLARE
    v_store_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the first user ID (assuming you're the only user, or replace with your specific user ID)
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    -- Check if user has any stores, if not create one
    SELECT id INTO v_store_id FROM stores WHERE owner_id = v_user_id LIMIT 1;
    
    IF v_store_id IS NULL THEN
        -- Create a new store
        INSERT INTO stores (owner_id, name, location)
        VALUES (v_user_id, 'My Store', 'Default Location')
        RETURNING id INTO v_store_id;
        
        RAISE NOTICE 'Created new store with ID: %', v_store_id;
    ELSE
        RAISE NOTICE 'Using existing store with ID: %', v_store_id;
    END IF;
    
    -- Step 2: Insert 14 tags for this store
    INSERT INTO tags (name, category, store_id, is_hard_constraint)
    VALUES 
        -- Soft Constraint Tags (7 tags) - Gray badges
        ('Social', 'occasion', v_store_id, false),
        ('Calm', 'mood', v_store_id, false),
        ('Energize', 'mood', v_store_id, false),
        ('Focus', 'mood', v_store_id, false),
        ('Sleep', 'mood', v_store_id, false),
        ('Gift', 'occasion', v_store_id, false),
        ('Casual', 'occasion', v_store_id, false),
        
        -- Hard Constraint Tags (7 tags) - Red badges
        ('No-sugar', 'dietary', v_store_id, true),
        ('Vegan', 'dietary', v_store_id, true),
        ('Gluten-free', 'dietary', v_store_id, true),
        ('Organic', 'dietary', v_store_id, true),
        ('THC-free', 'avoiding', v_store_id, true),
        ('Caffeine-free', 'avoiding', v_store_id, true),
        ('No-effect', 'avoiding', v_store_id, true);
    
    RAISE NOTICE '14 tags created successfully!';
END $$;

-- Verify the results
-- This will show your store and all its tags
SELECT 
    s.id as store_id,
    s.name as store_name,
    COUNT(t.id) as total_tags,
    COUNT(t.id) FILTER (WHERE t.is_hard_constraint = true) as hard_constraints,
    COUNT(t.id) FILTER (WHERE t.is_hard_constraint = false) as soft_preferences
FROM stores s
LEFT JOIN tags t ON t.store_id = s.id
GROUP BY s.id, s.name;

-- Show all tags with details
SELECT 
    s.name as store_name,
    t.name as tag_name,
    t.category,
    CASE 
        WHEN t.is_hard_constraint THEN 'Hard Constraint ✅' 
        ELSE 'Soft Preference ❌' 
    END as constraint_type,
    t.created_at
FROM stores s
LEFT JOIN tags t ON t.store_id = s.id
WHERE t.id IS NOT NULL
ORDER BY s.name, t.is_hard_constraint DESC, t.category, t.name;
