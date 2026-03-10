-- ========================================
-- STEP 2: ADD PRODUCTS TO EXISTING DATA
-- ========================================
-- Run this AFTER running check-existing-data.sql
-- This script assumes you already have:
-- - A store
-- - Zones (will match by name or create if missing)
-- - Tags (will match by name or create if missing)
-- ========================================

DO $$
DECLARE
    v_store_id UUID;
    
    -- Zone IDs (will get from existing or create)
    v_zone_calm UUID;
    v_zone_energy UUID;
    v_zone_social UUID;
    
    -- Tag IDs (will get from existing tags)
    v_tag_social UUID;
    v_tag_calm UUID;
    v_tag_energize UUID;
    v_tag_focus UUID;
    v_tag_sleep UUID;
    v_tag_nosugar UUID;
    v_tag_vegan UUID;
    v_tag_glutenfree UUID;
    v_tag_organic UUID;
    v_tag_thcfree UUID;
    v_tag_caffeinefree UUID;
    
    -- Product IDs
    v_prod_recess UUID;
    v_prod_kin UUID;
    v_prod_tea UUID;
    v_prod_poppi UUID;
    v_prod_olipop UUID;
    v_prod_hoplark UUID;
    v_prod_partake UUID;
    
BEGIN
    -- ========================================
    -- GET EXISTING STORE (must exist!)
    -- ========================================
    SELECT s.id INTO v_store_id 
    FROM stores s
    JOIN auth.users u ON s.owner_id = u.id
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    IF v_store_id IS NULL THEN
        RAISE EXCEPTION 'No store found! Please create a store first in the UI.';
    END IF;
    
    RAISE NOTICE 'Using store ID: %', v_store_id;

    -- ========================================
    -- GET OR CREATE ZONES
    -- ========================================
    
    -- Calm & Relax Zone
    SELECT id INTO v_zone_calm FROM zones WHERE store_id = v_store_id AND name = 'Calm & Relax';
    IF v_zone_calm IS NULL THEN
        INSERT INTO zones (store_id, name, description, zone_what, zone_when, zone_who)
        VALUES (
            v_store_id,
            'Calm & Relax',
            'Products for relaxation and stress relief',
            'Hemp-infused drinks, herbal teas, and adaptogens for relaxation',
            'After work, bedtime, or whenever you need to unwind',
            'Anyone seeking calm, stress relief, or better sleep'
        )
        RETURNING id INTO v_zone_calm;
        RAISE NOTICE 'Created zone: Calm & Relax';
    ELSE
        RAISE NOTICE 'Using existing zone: Calm & Relax (ID: %)', v_zone_calm;
    END IF;

    -- Energy & Focus Zone
    SELECT id INTO v_zone_energy FROM zones WHERE store_id = v_store_id AND name = 'Energy & Focus';
    IF v_zone_energy IS NULL THEN
        INSERT INTO zones (store_id, name, description, zone_what, zone_when, zone_who)
        VALUES (
            v_store_id,
            'Energy & Focus',
            'Energizing drinks without the crash',
            'Prebiotic sodas, hoppy teas, and functional beverages for energy',
            'Morning boost, afternoon pick-me-up, or pre-workout',
            'Anyone seeking natural energy and mental clarity'
        )
        RETURNING id INTO v_zone_energy;
        RAISE NOTICE 'Created zone: Energy & Focus';
    ELSE
        RAISE NOTICE 'Using existing zone: Energy & Focus (ID: %)', v_zone_energy;
    END IF;

    -- Social Sippers Zone
    SELECT id INTO v_zone_social FROM zones WHERE store_id = v_store_id AND name = 'Social Sippers';
    IF v_zone_social IS NULL THEN
        INSERT INTO zones (store_id, name, description, zone_what, zone_when, zone_who)
        VALUES (
            v_store_id,
            'Social Sippers',
            'Non-alcoholic drinks for social occasions',
            'NA beers, mocktails, and sophisticated alcohol alternatives',
            'Parties, dinners, celebrations, or any social gathering',
            'Social drinkers choosing healthier alternatives'
        )
        RETURNING id INTO v_zone_social;
        RAISE NOTICE 'Created zone: Social Sippers';
    ELSE
        RAISE NOTICE 'Using existing zone: Social Sippers (ID: %)', v_zone_social;
    END IF;

    -- ========================================
    -- GET OR CREATE TAGS
    -- ========================================
    
    -- Get existing tags or create if missing
    SELECT id INTO v_tag_social FROM tags WHERE store_id = v_store_id AND name = 'Social';
    IF v_tag_social IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Social', 'occasion', v_store_id, false) RETURNING id INTO v_tag_social;
    END IF;
    
    SELECT id INTO v_tag_calm FROM tags WHERE store_id = v_store_id AND name = 'Calm';
    IF v_tag_calm IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Calm', 'mood', v_store_id, false) RETURNING id INTO v_tag_calm;
    END IF;
    
    SELECT id INTO v_tag_energize FROM tags WHERE store_id = v_store_id AND name = 'Energize';
    IF v_tag_energize IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Energize', 'mood', v_store_id, false) RETURNING id INTO v_tag_energize;
    END IF;
    
    SELECT id INTO v_tag_focus FROM tags WHERE store_id = v_store_id AND name = 'Focus';
    IF v_tag_focus IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Focus', 'mood', v_store_id, false) RETURNING id INTO v_tag_focus;
    END IF;
    
    SELECT id INTO v_tag_sleep FROM tags WHERE store_id = v_store_id AND name = 'Sleep';
    IF v_tag_sleep IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Sleep', 'mood', v_store_id, false) RETURNING id INTO v_tag_sleep;
    END IF;
    
    SELECT id INTO v_tag_nosugar FROM tags WHERE store_id = v_store_id AND name = 'No-sugar';
    IF v_tag_nosugar IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('No-sugar', 'dietary', v_store_id, true) RETURNING id INTO v_tag_nosugar;
    END IF;
    
    SELECT id INTO v_tag_vegan FROM tags WHERE store_id = v_store_id AND name = 'Vegan';
    IF v_tag_vegan IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Vegan', 'dietary', v_store_id, true) RETURNING id INTO v_tag_vegan;
    END IF;
    
    SELECT id INTO v_tag_glutenfree FROM tags WHERE store_id = v_store_id AND name = 'Gluten-free';
    IF v_tag_glutenfree IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Gluten-free', 'dietary', v_store_id, true) RETURNING id INTO v_tag_glutenfree;
    END IF;
    
    SELECT id INTO v_tag_organic FROM tags WHERE store_id = v_store_id AND name = 'Organic';
    IF v_tag_organic IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Organic', 'dietary', v_store_id, true) RETURNING id INTO v_tag_organic;
    END IF;
    
    SELECT id INTO v_tag_thcfree FROM tags WHERE store_id = v_store_id AND name = 'THC-free';
    IF v_tag_thcfree IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('THC-free', 'avoiding', v_store_id, true) RETURNING id INTO v_tag_thcfree;
    END IF;
    
    SELECT id INTO v_tag_caffeinefree FROM tags WHERE store_id = v_store_id AND name = 'Caffeine-free';
    IF v_tag_caffeinefree IS NULL THEN
        INSERT INTO tags (name, category, store_id, is_hard_constraint) VALUES ('Caffeine-free', 'avoiding', v_store_id, true) RETURNING id INTO v_tag_caffeinefree;
    END IF;

    RAISE NOTICE 'All tags ready (existing or created)';

    -- ========================================
    -- ADD PRODUCTS (ONLY IF THEY DON'T EXIST)
    -- ========================================

    -- Product 4: Recess Mood
    SELECT id INTO v_prod_recess FROM products WHERE store_id = v_store_id AND sku = 'RECESS-MOOD-12OZ';
    IF v_prod_recess IS NULL THEN
        INSERT INTO products (store_id, zone_id, name, sku, description, price, image_url, in_stock, is_staff_pick)
        VALUES (
            v_store_id, v_zone_calm, 'Recess Mood', 'RECESS-MOOD-12OZ',
            'Hemp-infused sparkling water with adaptogens. Calming, not sedating.',
            5.99, 'https://m.media-amazon.com/images/S/aplus-media-library-service-media/3f758730-e76e-4103-ba17-f471e7ce9c4f.__CR0,0,1200,900_PT0_SX600_V1___.jpg',
            true, true
        ) RETURNING id INTO v_prod_recess;
        RAISE NOTICE 'Created: Recess Mood';
    ELSE
        RAISE NOTICE 'Skipped (exists): Recess Mood';
    END IF;

    -- Product 5: Kin Spritz
    SELECT id INTO v_prod_kin FROM products WHERE store_id = v_store_id AND sku = 'KIN-SPRITZ-8OZ';
    IF v_prod_kin IS NULL THEN
        INSERT INTO products (store_id, zone_id, name, sku, description, price, image_url, in_stock, is_staff_pick)
        VALUES (
            v_store_id, v_zone_calm, 'Kin Spritz', 'KIN-SPRITZ-8OZ',
            'Euphorics with adaptogens, nootropics, and botanicals. Stress relief.',
            39.00, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSpUsaex31S9226oTGdQOSqSZg7xCpcYe71Iw&s',
            true, false
        ) RETURNING id INTO v_prod_kin;
        RAISE NOTICE 'Created: Kin Spritz';
    ELSE
        RAISE NOTICE 'Skipped (exists): Kin Spritz';
    END IF;

    -- Product 6: Calm Tea
    SELECT id INTO v_prod_tea FROM products WHERE store_id = v_store_id AND sku = 'CALM-TEA-20CT';
    IF v_prod_tea IS NULL THEN
        INSERT INTO products (store_id, zone_id, name, sku, description, price, image_url, in_stock, is_staff_pick)
        VALUES (
            v_store_id, v_zone_calm, 'Soberish Calm Herbal Tea', 'CALM-TEA-20CT',
            'Chamomile, lavender, and passionflower. Perfect for bedtime.',
            12.99, 'https://us.foursigmatic.com/cdn/shop/files/ThinkTeaLifestyleIced-1_Square_copy.webp?crop=center&height=700&v=1716227065&width=700',
            true, false
        ) RETURNING id INTO v_prod_tea;
        RAISE NOTICE 'Created: Calm Tea';
    ELSE
        RAISE NOTICE 'Skipped (exists): Calm Tea';
    END IF;

    -- Product 7: Poppi Orange
    SELECT id INTO v_prod_poppi FROM products WHERE store_id = v_store_id AND sku = 'POPPI-ORANGE-12OZ';
    IF v_prod_poppi IS NULL THEN
        INSERT INTO products (store_id, zone_id, name, sku, description, price, image_url, in_stock, is_staff_pick)
        VALUES (
            v_store_id, v_zone_energy, 'Poppi Orange Prebiotic Soda', 'POPPI-ORANGE-12OZ',
            'Apple cider vinegar soda with prebiotics. Refreshing, gut-friendly.',
            3.49, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRF4UdYagWOQpuVlZj8EW-YwK5wOSHz54Mq2g&s',
            true, true
        ) RETURNING id INTO v_prod_poppi;
        RAISE NOTICE 'Created: Poppi Orange';
    ELSE
        RAISE NOTICE 'Skipped (exists): Poppi Orange';
    END IF;

    -- Product 8: Olipop Cola
    SELECT id INTO v_prod_olipop FROM products WHERE store_id = v_store_id AND sku = 'OLIPOP-COLA-12OZ';
    IF v_prod_olipop IS NULL THEN
        INSERT INTO products (store_id, zone_id, name, sku, description, price, image_url, in_stock, is_staff_pick)
        VALUES (
            v_store_id, v_zone_energy, 'Olipop Vintage Cola', 'OLIPOP-COLA-12OZ',
            'Prebiotic soda with 9g fiber. Tastes like nostalgia, feels like wellness.',
            3.99, 'https://marvel-b1-cdn.bc0a.com/f00000000205501/www.fruitfulyield.com/media/catalog/product/cache/b69948113e5023d37b0ec38a936ce2ea/8/6/860439001005-main.png',
            true, false
        ) RETURNING id INTO v_prod_olipop;
        RAISE NOTICE 'Created: Olipop Cola';
    ELSE
        RAISE NOTICE 'Skipped (exists): Olipop Cola';
    END IF;

    -- Product 9: HopLark
    SELECT id INTO v_prod_hoplark FROM products WHERE store_id = v_store_id AND sku = 'HOPLARK-HOPPY-12OZ';
    IF v_prod_hoplark IS NULL THEN
        INSERT INTO products (store_id, zone_id, name, sku, description, price, image_url, in_stock, is_staff_pick)
        VALUES (
            v_store_id, v_zone_energy, 'HopLark The Really Hoppy One', 'HOPLARK-HOPPY-12OZ',
            'Sparkling HopTea. Energizing, refreshing, zero sugar.',
            4.49, 'https://m.media-amazon.com/images/S/assets.wholefoodsmarket.com/PIE/product/62eb2a7379c0186618a19ea8_0854948008037-glamor-front-2022-07-12t14-22-20-iphone-x-quality-90-1-29-0-user-5d7652c1db2c4b51d4c666ca-vx1o-447998._TTD_._SR600,600_._QL100_.jpg',
            true, false
        ) RETURNING id INTO v_prod_hoplark;
        RAISE NOTICE 'Created: HopLark';
    ELSE
        RAISE NOTICE 'Skipped (exists): HopLark';
    END IF;

    -- Product 10: Partake Blonde
    SELECT id INTO v_prod_partake FROM products WHERE store_id = v_store_id AND sku = 'PARTAKE-BLONDE-6PK';
    IF v_prod_partake IS NULL THEN
        INSERT INTO products (store_id, zone_id, name, sku, description, price, image_url, in_stock, is_staff_pick)
        VALUES (
            v_store_id, v_zone_social, 'Partake Blonde Ale', 'PARTAKE-BLONDE-6PK',
            'Light, crisp, refreshing. Only 10 calories, zero sugar.',
            9.49, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2townp2CCdcOEZ3ndMnoPNTfile79iTDbxA&s',
            true, false
        ) RETURNING id INTO v_prod_partake;
        RAISE NOTICE 'Created: Partake Blonde';
    ELSE
        RAISE NOTICE 'Skipped (exists): Partake Blonde';
    END IF;

    -- ========================================
    -- LINK TAGS TO PRODUCTS (SKIP IF ALREADY LINKED)
    -- ========================================

    -- Helper: Insert tag only if not already linked
    -- Recess Mood tags
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_recess, v_tag_calm) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_recess, v_tag_nosugar) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_recess, v_tag_vegan) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_recess, v_tag_glutenfree) ON CONFLICT DO NOTHING;

    -- Kin Spritz tags
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_kin, v_tag_calm) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_kin, v_tag_vegan) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_kin, v_tag_glutenfree) ON CONFLICT DO NOTHING;

    -- Calm Tea tags
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_tea, v_tag_calm) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_tea, v_tag_sleep) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_tea, v_tag_vegan) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_tea, v_tag_organic) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_tea, v_tag_thcfree) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_tea, v_tag_caffeinefree) ON CONFLICT DO NOTHING;

    -- Poppi Orange tags
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_poppi, v_tag_energize) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_poppi, v_tag_nosugar) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_poppi, v_tag_vegan) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_poppi, v_tag_glutenfree) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_poppi, v_tag_thcfree) ON CONFLICT DO NOTHING;

    -- Olipop Cola tags
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_olipop, v_tag_energize) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_olipop, v_tag_vegan) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_olipop, v_tag_glutenfree) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_olipop, v_tag_thcfree) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_olipop, v_tag_caffeinefree) ON CONFLICT DO NOTHING;

    -- HopLark tags
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_hoplark, v_tag_energize) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_hoplark, v_tag_focus) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_hoplark, v_tag_nosugar) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_hoplark, v_tag_vegan) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_hoplark, v_tag_thcfree) ON CONFLICT DO NOTHING;

    -- Partake Blonde tags
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_partake, v_tag_social) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_partake, v_tag_nosugar) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_partake, v_tag_glutenfree) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_partake, v_tag_thcfree) ON CONFLICT DO NOTHING;
    INSERT INTO product_tags (product_id, tag_id) VALUES (v_prod_partake, v_tag_caffeinefree) ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ All products and tags linked successfully!';

END $$;

-- Verification
SELECT 
    '✅ COMPLETE!' as status,
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(*) FROM product_tags) as total_tag_links;
