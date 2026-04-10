import { NextResponse } from "next/server";
import { nango } from "@/lib/nango";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { connectionId } = await request.json();
    if (!connectionId) {
      return NextResponse.json(
        { error: "Missing connectionId" },
        { status: 400 },
      );
    }

    // Nango auto-refreshes the token on every getConnection call
    const connection = await nango.getConnection("shopify", connectionId);
    const token = (connection.credentials as any).access_token;
    const shopDomain = connection.connection_config?.shop;

    const res = await fetch(
      `https://${shopDomain}/admin/api/2024-01/products.json?limit=250`,
      { headers: { "X-Shopify-Access-Token": token } },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.errors || `Shopify error ${res.status}` },
        { status: 502 },
      );
    }

    const { products } = await res.json();

    // Normalize to your internal product shape
    const normalized = products.map((p: any) => ({
      name: p.title,
      description: p.body_html || null,
      sku: p.variants?.[0]?.sku || null,
      price: p.variants?.[0]?.price || null,
      image_url: p.images?.[0]?.src || null,
      in_stock: p.status === "active",
    }));

    return NextResponse.json({ products: normalized });
  } catch (err: any) {
    console.error("[Nango Shopify Products]", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
