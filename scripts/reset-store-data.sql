-- Reset Store Data Script
-- This deletes ALL data for your store while preserving the store itself
-- Run this in Supabase SQL Editor BEFORE running seed.sql

-- WARNING: This will delete:
-- - All products, tags, zones
-- - All customer profiles and visits
-- - All form submissions and analytics
-- Store and form structure are preserved

-- Replace with your store ID
-- Store ID: dd506da8-51c8-4f0c-8bfe-988e1e9b4265

-- Delete in order (respecting foreign keys)

-- 1. Delete product-tag links
DELETE FROM product_tags WHERE product_id IN (
  SELECT id FROM products WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265'
);

-- 2. Delete products
DELETE FROM products WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';

-- 3. Delete tags
DELETE FROM tags WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';

-- 4. Delete zones
DELETE FROM zones WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';

-- 5. Delete customers
DELETE FROM customers WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265';

-- 6. Delete form submissions
DELETE FROM form_submissions WHERE form_id IN (
  SELECT id FROM forms WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265'
);

-- 7. Delete form visits
DELETE FROM form_visits WHERE form_id IN (
  SELECT id FROM forms WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265'
);

-- Output summary
SELECT 
  'Reset complete. Store and forms preserved.' as status,
  (SELECT COUNT(*) FROM products WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265') as products_remaining,
  (SELECT COUNT(*) FROM tags WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265') as tags_remaining,
  (SELECT COUNT(*) FROM zones WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265') as zones_remaining,
  (SELECT COUNT(*) FROM customers WHERE store_id = 'dd506da8-51c8-4f0c-8bfe-988e1e9b4265') as customers_remaining;
