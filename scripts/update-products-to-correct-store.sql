-- ========================================
-- UPDATE PRODUCTS TO CORRECT STORE & ZONES
-- ========================================
-- This will move all products to store: cbc282a9-15ea-4fc8-9f3e-6f31687981de
-- And map them to the correct zones and tags
-- ========================================

DO $$
DECLARE
    v_store_id UUID := 'cbc282a9-15ea-4fc8-9f3e-6f31687981de';
    
    -- Zone IDs from your data
    v_zone_energy UUID := '62346bc4-2621-41a4-a23a-cf104c14e2e2';  -- Energy & Focus
    v_zone_calm UUID := 'dd44934c-2072-4a27-aab7-ff5da071a1e8';    -- Calm & Relax
    v_zone_social UUID := 'f69ddab9-ea45-4197-919a-dcabab88893c';  -- Social Sippers
    
    -- Tag IDs from your store (cbc282a9)
    v_tag_calm UUID := '73d5b0da-3297-4139-9381-fe3f1175c937';
    v_tag_energize UUID := 'bb66373f-5a00-4c10-9043-82a6b0c9325e';
    v_tag_focus UUID := '5f81a0e1-aa5c-48c6-9e91-8d4bb75cf855';
    v_tag_sleep UUID := '4a17f792-3f20-4f51-bee5-9158f1429fae';
    v_tag_social UUID := '7188c538-e64f-4bee-9d41-4731d7c2b9a9';
    v_tag_nosugar UUID := '1b317851-98cf-499b-b07e-320ea0882d22';
    v_tag_vegan UUID := '08db43fa-5835-430d-8edb-8828b241bc55';
    v_tag_glutenfree UUID := '3069a537-95fb-4434-8dd1-6b28f22ecb9a';
    v_tag_organic UUID := '374bf92d-380c-4486-a80b-fe9feec03463';
    v_tag_thcfree UUID := '4282f482-cc87-407c-af15-b03aea21046d';
    v_tag_caffeinefree UUID := '09bdf392-8037-450e-a608-a71a9a8ffba8';
    
BEGIN
    RAISE NOTICE 'Starting product updates...';
    
    -- ========================================
    -- STEP 1: UPDATE ALL PRODUCTS TO CORRECT STORE & ZONE
    -- ========================================
    
    -- HopLark → Energy & Focus
    UPDATE products SET store_id = v_store_id, zone_id = v_zone_energy 
    WHERE sku = 'HOPLARK-HOPPY-12OZ';
    
    -- Partake Blonde → Social Sippers
    UPDATE products SET store_id = v_store_id, zone_id = v_zone_social 
    WHERE sku = 'PARTAKE-BLONDE-6PK';
    
    -- Olipop Cola → Energy & Focus
    UPDATE products SET store_id = v_store_id, zone_id = v_zone_energy 
    WHERE sku = 'OLIPOP-COLA-12OZ';
    
    -- Kin Spritz → Calm & Relax
    UPDATE products SET store_id = v_store_id, zone_id = v_zone_calm 
    WHERE sku = 'KIN-SPRITZ-8OZ';
    
    -- Calm Tea → Calm & Relax
    UPDATE products SET store_id = v_store_id, zone_id = v_zone_calm 
    WHERE sku = 'CALM-TEA-20CT';
    
    -- Recess Mood → Calm & Relax
    UPDATE products SET store_id = v_store_id, zone_id = v_zone_calm 
    WHERE sku = 'RECESS-MOOD-12OZ';
    
    -- Poppi Orange → Energy & Focus
    UPDATE products SET store_id = v_store_id, zone_id = v_zone_energy 
    WHERE sku = 'POPPI-ORANGE-12OZ';
    
    RAISE NOTICE '✅ Products updated to store cbc282a9';
    
    -- ========================================
    -- STEP 2: DELETE OLD TAG LINKS (from wrong store)
    -- ========================================
    
    DELETE FROM product_tags 
    WHERE product_id IN (
        SELECT id FROM products WHERE sku IN (
            'HOPLARK-HOPPY-12OZ',
            'PARTAKE-BLONDE-6PK', 
            'OLIPOP-COLA-12OZ',
            'KIN-SPRITZ-8OZ',
            'CALM-TEA-20CT',
            'RECESS-MOOD-12OZ',
            'POPPI-ORANGE-12OZ'
        )
    );
    
    RAISE NOTICE '✅ Old tag links deleted';
    
    -- ========================================
    -- STEP 3: CREATE NEW TAG LINKS (with correct store tags)
    -- ========================================
    
    -- Recess Mood: Calm, No-sugar, Vegan, Gluten-free
    INSERT INTO product_tags (product_id, tag_id)
    SELECT id, v_tag_calm FROM products WHERE sku = 'RECESS-MOOD-12OZ'
    UNION ALL SELECT id, v_tag_nosugar FROM products WHERE sku = 'RECESS-MOOD-12OZ'
    UNION ALL SELECT id, v_tag_vegan FROM products WHERE sku = 'RECESS-MOOD-12OZ'
    UNION ALL SELECT id, v_tag_glutenfree FROM products WHERE sku = 'RECESS-MOOD-12OZ';
    
    -- Kin Spritz: Calm, Vegan, Gluten-free
    INSERT INTO product_tags (product_id, tag_id)
    SELECT id, v_tag_calm FROM products WHERE sku = 'KIN-SPRITZ-8OZ'
    UNION ALL SELECT id, v_tag_vegan FROM products WHERE sku = 'KIN-SPRITZ-8OZ'
    UNION ALL SELECT id, v_tag_glutenfree FROM products WHERE sku = 'KIN-SPRITZ-8OZ';
    
    -- Calm Tea: Calm, Sleep, Vegan, Organic, THC-free, Caffeine-free
    INSERT INTO product_tags (product_id, tag_id)
    SELECT id, v_tag_calm FROM products WHERE sku = 'CALM-TEA-20CT'
    UNION ALL SELECT id, v_tag_sleep FROM products WHERE sku = 'CALM-TEA-20CT'
    UNION ALL SELECT id, v_tag_vegan FROM products WHERE sku = 'CALM-TEA-20CT'
    UNION ALL SELECT id, v_tag_organic FROM products WHERE sku = 'CALM-TEA-20CT'
    UNION ALL SELECT id, v_tag_thcfree FROM products WHERE sku = 'CALM-TEA-20CT'
    UNION ALL SELECT id, v_tag_caffeinefree FROM products WHERE sku = 'CALM-TEA-20CT';
    
    -- Poppi Orange: Energize, No-sugar, Vegan, Gluten-free, THC-free
    INSERT INTO product_tags (product_id, tag_id)
    SELECT id, v_tag_energize FROM products WHERE sku = 'POPPI-ORANGE-12OZ'
    UNION ALL SELECT id, v_tag_nosugar FROM products WHERE sku = 'POPPI-ORANGE-12OZ'
    UNION ALL SELECT id, v_tag_vegan FROM products WHERE sku = 'POPPI-ORANGE-12OZ'
    UNION ALL SELECT id, v_tag_glutenfree FROM products WHERE sku = 'POPPI-ORANGE-12OZ'
    UNION ALL SELECT id, v_tag_thcfree FROM products WHERE sku = 'POPPI-ORANGE-12OZ';
    
    -- Olipop Cola: Energize, Vegan, Gluten-free, THC-free, Caffeine-free
    INSERT INTO product_tags (product_id, tag_id)
    SELECT id, v_tag_energize FROM products WHERE sku = 'OLIPOP-COLA-12OZ'
    UNION ALL SELECT id, v_tag_vegan FROM products WHERE sku = 'OLIPOP-COLA-12OZ'
    UNION ALL SELECT id, v_tag_glutenfree FROM products WHERE sku = 'OLIPOP-COLA-12OZ'
    UNION ALL SELECT id, v_tag_thcfree FROM products WHERE sku = 'OLIPOP-COLA-12OZ'
    UNION ALL SELECT id, v_tag_caffeinefree FROM products WHERE sku = 'OLIPOP-COLA-12OZ';
    
    -- HopLark: Energize, Focus, No-sugar, Vegan, THC-free
    INSERT INTO product_tags (product_id, tag_id)
    SELECT id, v_tag_energize FROM products WHERE sku = 'HOPLARK-HOPPY-12OZ'
    UNION ALL SELECT id, v_tag_focus FROM products WHERE sku = 'HOPLARK-HOPPY-12OZ'
    UNION ALL SELECT id, v_tag_nosugar FROM products WHERE sku = 'HOPLARK-HOPPY-12OZ'
    UNION ALL SELECT id, v_tag_vegan FROM products WHERE sku = 'HOPLARK-HOPPY-12OZ'
    UNION ALL SELECT id, v_tag_thcfree FROM products WHERE sku = 'HOPLARK-HOPPY-12OZ';
    
    -- Partake Blonde: Social, No-sugar, Gluten-free, THC-free, Caffeine-free
    INSERT INTO product_tags (product_id, tag_id)
    SELECT id, v_tag_social FROM products WHERE sku = 'PARTAKE-BLONDE-6PK'
    UNION ALL SELECT id, v_tag_nosugar FROM products WHERE sku = 'PARTAKE-BLONDE-6PK'
    UNION ALL SELECT id, v_tag_glutenfree FROM products WHERE sku = 'PARTAKE-BLONDE-6PK'
    UNION ALL SELECT id, v_tag_thcfree FROM products WHERE sku = 'PARTAKE-BLONDE-6PK'
    UNION ALL SELECT id, v_tag_caffeinefree FROM products WHERE sku = 'PARTAKE-BLONDE-6PK';
    
    RAISE NOTICE '✅ All tag links created with correct store tags';
    
END $$;

-- ========================================
-- VERIFICATION
-- ========================================

-- Check all products are in the correct store
SELECT 
    name,
    sku,
    CASE 
        WHEN store_id = 'cbc282a9-15ea-4fc8-9f3e-6f31687981de' THEN '✅ Correct Store'
        ELSE '❌ Wrong Store'
    END as store_status,
    (SELECT name FROM zones WHERE id = zone_id) as zone_name,
    is_staff_pick
FROM products
ORDER BY zone_name, name;

-- Check tag counts per product
SELECT 
    p.name as product_name,
    COUNT(pt.tag_id) as tag_count,
    STRING_AGG(t.name, ', ' ORDER BY t.name) as tags
FROM products p
LEFT JOIN product_tags pt ON pt.product_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id
WHERE p.store_id = 'cbc282a9-15ea-4fc8-9f3e-6f31687981de'
GROUP BY p.id, p.name
ORDER BY p.name;

-- Summary
SELECT 
    '✅ UPDATE COMPLETE!' as status,
    (SELECT COUNT(*) FROM products WHERE store_id = 'cbc282a9-15ea-4fc8-9f3e-6f31687981de') as products_in_store,
    (SELECT COUNT(*) FROM product_tags WHERE product_id IN (
        SELECT id FROM products WHERE store_id = 'cbc282a9-15ea-4fc8-9f3e-6f31687981de'
    )) as total_tag_links;
