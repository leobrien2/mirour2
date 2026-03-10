import { NextRequest, NextResponse } from "next/server";

const SQUARESPACE_BASE_URL = "https://api.squarespace.com/1.0";

/**
 * Strip HTML tags and decode common entities from a Squarespace HTML description.
 * e.g. '<p style="...">Text here.</p>' → 'Text here.'
 */
function stripHtml(html: string): string {
  if (!html) return "";
  return (
    html
      // Replace block-level tags with newlines for readability
      .replace(/<\/(p|div|br|li|h[1-6]|blockquote|tr)[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      // Remove all remaining HTML tags
      .replace(/<[^>]+>/g, "")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&ndash;/g, "–")
      .replace(/&mdash;/g, "—")
      // Collapse 3+ newlines to 2, trim leading/trailing whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Server-side proxy for Squarespace Commerce Products API.
 * Fetches all pages of products, flattens variants into individual rows,
 * and returns them as a JSON array.
 *
 * POST /api/squarespace/products
 * Body: { apiKey: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "apiKey is required" },
        { status: 400 },
      );
    }

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Squarespace-Version": "2023-01-01",
      "Content-Type": "application/json",
      "User-Agent": "MirourImportProxy/1.0",
    };

    // Fetch all pages
    const allProducts: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;
    const MAX_PAGES = 50; // Safety limit

    while (hasNextPage && pageCount < MAX_PAGES) {
      const url = new URL(`${SQUARESPACE_BASE_URL}/commerce/products`);
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          {
            error: `Squarespace API error: ${response.status} ${response.statusText}. ${errorText}`,
          },
          { status: response.status === 401 ? 401 : 502 },
        );
      }

      const data = await response.json();
      const pageProducts: any[] = data.products || [];
      allProducts.push(...pageProducts);

      const pagination = data.pagination || {};
      hasNextPage = pagination.hasNextPage === true;
      cursor = pagination.nextPageCursor || null;
      pageCount++;
    }

    // Flatten variants into individual product rows
    const flatProducts: any[] = [];

    for (const product of allProducts) {
      const baseName: string = product.name || "Unnamed Product";
      const baseDescription: string = stripHtml(product.description || "");
      const baseUrl: string = product.url || "";

      const variants: any[] = product.variants || [];

      if (variants.length === 0) {
        // No variants — add as single product
        flatProducts.push({
          name: baseName,
          description: baseDescription,
          url: baseUrl,
          sku: null,
          price: null,
          image_url: null,
          in_stock: true,
        });
        continue;
      }

      for (const variant of variants) {
        const attributes: Record<string, string> = variant.attributes || {};
        const attrStr = Object.entries(attributes)
          .map(([k, v]) => `${k}:${v}`)
          .join(", ");

        // Build variant name: "Base Name – Attr1:Val1, Attr2:Val2"
        const variantName = attrStr ? `${baseName} – ${attrStr}` : baseName;

        const pricing = variant.pricing || {};
        const priceObj = variant.price || {};
        const inventory = variant.inventory || {};
        const imageObj = variant.image || {};

        // Price: try variant.price.value first, then pricing.basePrice.value
        const price = priceObj.value ?? pricing.basePrice?.value ?? null;

        // In stock: unlimited OR quantity > 0
        const inStock =
          inventory.unlimited === true ||
          (typeof inventory.quantity === "number" && inventory.quantity > 0);

        flatProducts.push({
          name: variantName,
          description: baseDescription,
          url: baseUrl,
          sku: variant.sku || null,
          price: price !== null ? String(price) : null,
          image_url: imageObj.url || null,
          in_stock: inStock,
        });
      }
    }

    return NextResponse.json({
      products: flatProducts,
      total: flatProducts.length,
    });
  } catch (err: any) {
    console.error("[squarespace/products] Error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 },
    );
  }
}
