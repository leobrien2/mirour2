
-- SQL Script to Seed Test Data for Sprint 3 Verification
-- Run this in Supabase SQL Editor

-- 1. Variables (Store ID)
-- Using existing Store ID from list-forms.ts output
-- Store: dd506da8-51c8-4f0c-8bfe-988e1e9b4265 (Tanmay's Store)
-- Form: eaa5c406-633c-4b9e-92e0-c3c64ca8a10a (Entrance Tanmay)

-- 2. Upsert Tags
INSERT INTO tags (name, store_id, is_hard_constraint)
VALUES 
    ('Social', 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265', false),
    ('Calm', 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265', false),
    ('No-sugar', 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265', true),
    ('THC-free', 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265', true)
ON CONFLICT (store_id, name) DO NOTHING;

-- 3. Upsert Zone 'Social Sippers'
INSERT INTO zones (name, store_id, zone_what, zone_when, zone_who)
VALUES (
    'Social Sippers', 
    'dd506da8-51c8-4f0c-8bfe-988e1e9b4265',
    'Non-alcoholic cocktails and craft sodas',
    'Parties, dinners, social gatherings',
    'Social substituters looking for celebration'
)
ON CONFLICT (store_id, name) DO UPDATE SET
    zone_what = EXCLUDED.zone_what,
    zone_when = EXCLUDED.zone_when,
    zone_who = EXCLUDED.zone_who;

-- Get Zone ID (for use in products - assuming we can't use variable easily in standard SQL script without DO block)
-- We'll use a subquery for zone_id

-- 4. Upsert Products
-- Ghia Spritz
INSERT INTO products (name, store_id, description, price, image_url, zone_id, is_staff_pick)
VALUES (
    'Ghia Spritz',
    'dd506da8-51c8-4f0c-8bfe-988e1e9b4265',
    'Test Product Ghia Spritz',
    10,
    'https://placehold.co/400',
    (SELECT id FROM zones WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265' AND name = 'Social Sippers' LIMIT 1),
    false
)
ON CONFLICT (store_id, name) DO UPDATE SET
    zone_id = EXCLUDED.zone_id;

-- Sugary Soda
INSERT INTO products (name, store_id, description, price, image_url, zone_id, is_staff_pick)
VALUES (
    'Sugary Soda',
    'dd506da8-51c8-4f0c-8bfe-988e1e9b4265',
    'Test Product Sugary Soda',
    10,
    'https://placehold.co/400',
    (SELECT id FROM zones WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265' AND name = 'Social Sippers' LIMIT 1),
    false
)
ON CONFLICT (store_id, name) DO UPDATE SET
    zone_id = EXCLUDED.zone_id;

-- Calm Tea
INSERT INTO products (name, store_id, description, price, image_url, zone_id, is_staff_pick)
VALUES (
    'Calm Tea',
    'dd506da8-51c8-4f0c-8bfe-988e1e9b4265',
    'Test Product Calm Tea',
    10,
    'https://placehold.co/400',
    (SELECT id FROM zones WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265' AND name = 'Social Sippers' LIMIT 1),
    false
)
ON CONFLICT (store_id, name) DO UPDATE SET
    zone_id = EXCLUDED.zone_id;

-- 5. Link Product Tags
-- Clear existing tags for these products to avoid duplicates or stale data
DELETE FROM product_tags WHERE product_id IN (
    SELECT id FROM products WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265' 
    AND name IN ('Ghia Spritz', 'Sugary Soda', 'Calm Tea')
);

-- Link Ghia Spritz -> Social, No-sugar, THC-free
INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id
FROM products p, tags t
WHERE p.name = 'Ghia Spritz' AND p.store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265'
AND t.name IN ('Social', 'No-sugar', 'THC-free') AND t.store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';

-- Link Sugary Soda -> Social
INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id
FROM products p, tags t
WHERE p.name = 'Sugary Soda' AND p.store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265'
AND t.name IN ('Social') AND t.store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';

-- Link Calm Tea -> Calm, No-sugar, THC-free
INSERT INTO product_tags (product_id, tag_id)
SELECT p.id, t.id
FROM products p, tags t
WHERE p.name = 'Calm Tea' AND p.store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265'
AND t.name IN ('Calm', 'No-sugar', 'THC-free') AND t.store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';

-- 6. Update Form Questions
-- We need Tag IDs for the JSON.
-- We can use a DO block to construct the JSON with real IDs, or just use subqueries in the update if Supabase supports it.
-- But constructing complex JSON with subqueries is hard.
-- EASIER: Just assume the Tags exist and match names. 
-- BUT questions JSON needs "addTags": ["UUID", "UUID"].
-- I will use a DO block to update the form.

DO $$
DECLARE
    store_uuid UUID := 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';
    -- Tag IDs
    t_social UUID;
    t_calm UUID;
    t_nosugar UUID;
    t_thc UUID;
    
    questions_json JSONB;
BEGIN
    SELECT id INTO t_social FROM tags WHERE store_id = store_uuid AND name = 'Social';
    SELECT id INTO t_calm FROM tags WHERE store_id = store_uuid AND name = 'Calm';
    SELECT id INTO t_nosugar FROM tags WHERE store_id = store_uuid AND name = 'No-sugar';
    SELECT id INTO t_thc FROM tags WHERE store_id = store_uuid AND name = 'THC-free';

    questions_json := jsonb_build_array(
        jsonb_build_object(
            'id', 'welcome',
            'type', 'welcome',
            'content', 'Welcome to {{zone_name}}',
            'contentType', 'text',
            'buttonText', 'Start'
        ),
        jsonb_build_object(
            'id', 'q1',
            'type', 'question',
            'text', 'What is the occasion? (SQL Seeded)',
            'questionType', 'single_select',
            'options', jsonb_build_array(
                jsonb_build_object('label', 'Social gathering', 'value', 'social', 'nextId', 'q2'),
                jsonb_build_object('label', 'Other', 'value', 'other', 'nextId', 'rec')
            ),
            'conditionalNext', jsonb_build_array(
                jsonb_build_object('optionValue', 'social', 'nextNodeId', 'q2', 'addTags', jsonb_build_array(t_social))
            )
        ),
        jsonb_build_object(
            'id', 'q2',
            'type', 'question',
            'text', 'How do you want to feel?',
            'questionType', 'single_select',
            'options', jsonb_build_array(
                jsonb_build_object('label', 'Relaxed and calm', 'value', 'calm', 'nextId', 'q3'),
                jsonb_build_object('label', 'Energetic', 'value', 'energy', 'nextId', 'rec')
            ),
            'conditionalNext', jsonb_build_array(
                jsonb_build_object('optionValue', 'calm', 'nextNodeId', 'q3', 'addTags', jsonb_build_array(t_calm))
            )
        ),
        jsonb_build_object(
            'id', 'q3',
            'type', 'question',
            'text', 'Dietary preferences?',
            'questionType', 'multi_select',
            'options', jsonb_build_array(
                jsonb_build_object('label', 'No Sugar', 'value', 'nosugar'),
                jsonb_build_object('label', 'THC Free', 'value', 'thc')
            ),
            'conditionalNext', jsonb_build_array(
                jsonb_build_object('optionValue', 'nosugar', 'addTags', jsonb_build_array(t_nosugar)),
                jsonb_build_object('optionValue', 'thc', 'addTags', jsonb_build_array(t_thc))
            ),
            'nextId', 'rec'
        ),
        jsonb_build_object(
            'id', 'rec',
            'type', 'recommendation',
            'recommendationLogic', jsonb_build_object('matchStrategy', 'all', 'limit', 3)
        )
    );

    UPDATE forms 
    SET questions = questions_json, active = true
    WHERE id = 'eaa5c406-633c-4b9e-92e0-c3c64ca8a10a';
    
END $$;
