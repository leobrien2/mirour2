-- Enable public read access to products
CREATE POLICY "Enable public read access for products" 
ON public.products FOR SELECT 
USING (true);

-- Enable public read access to tags
CREATE POLICY "Enable public read access for tags" 
ON public.tags FOR SELECT 
USING (true);

-- Enable public read access to product_tags
CREATE POLICY "Enable public read access for product_tags" 
ON public.product_tags FOR SELECT 
USING (true);
