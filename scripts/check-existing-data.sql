-- ========================================
-- STEP 1: CHECK EXISTING DATA
-- ========================================
-- Run this FIRST to see what stores, zones, and tags you already have
-- Copy the IDs you want to use for the product insert script
-- ========================================

-- Your stores
SELECT 
    id,
    name,
    location,
    created_at
FROM stores
ORDER BY created_at DESC;

-- Your zones
SELECT 
    z.id,
    z.name,
    z.description,
    s.name as store_name
FROM zones z
JOIN stores s ON z.store_id = s.id
ORDER BY s.name, z.name;

-- Your tags
SELECT 
    t.id,
    t.name,
    t.category,
    CASE 
        WHEN t.is_hard_constraint THEN '✅ Hard' 
        ELSE '❌ Soft' 
    END as constraint_type,
    s.name as store_name
FROM tags t
JOIN stores s ON t.store_id = s.id
ORDER BY s.name, t.is_hard_constraint DESC, t.category, t.name;

-- Summary counts
SELECT 
    (SELECT COUNT(*) FROM stores WHERE owner_id = (SELECT id FROM auth.users LIMIT 1)) as my_stores,
    (SELECT COUNT(*) FROM zones WHERE store_id IN (SELECT id FROM stores WHERE owner_id = (SELECT id FROM auth.users LIMIT 1))) as my_zones,
    (SELECT COUNT(*) FROM tags WHERE store_id IN (SELECT id FROM stores WHERE owner_id = (SELECT id FROM auth.users LIMIT 1))) as my_tags,
    (SELECT COUNT(*) FROM products WHERE store_id IN (SELECT id FROM stores WHERE owner_id = (SELECT id FROM auth.users LIMIT 1))) as my_products;
