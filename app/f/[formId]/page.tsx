// app/f/[formId]/page.tsx
import { notFound } from "next/navigation";
import type { CanvasFlow } from "@/types/canvas";
import type { Product } from "@/types/mirour";
import { createClient } from "@/utils/supabase/server";
import { FlowPlayer } from "@/components/dashboard/FlowBuilder/canvas/FlowPlayer";

interface PageProps {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ zone?: string }>;
}

interface FormRow {
  id: string;
  name: string;
  store_id: string | null; // ← real col name from DB output
  active: boolean;
  questions: string; // ← real col name — stored as JSON string of steps[]
  perk: string | null;
}

async function getFormWithFlow(formId: string): Promise<FormRow | null> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("forms")
    .select("id, name, store_id, active, questions, perk") // ← fixed
    .eq("id", formId)
    .single();

  if (error || !data) return null;
  // if (!data.active) return null;

  return data as FormRow;
}

async function getStoreProducts(storeId: string): Promise<Product[]> {
  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("products")
    .select(`id, name, price, imageurl, tags (id, name)`)
    .eq("store_id", storeId) // ← fixed: store_id not storeid
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as Product[];
}

export default async function PublicFlowPage({
  params,
  searchParams,
}: PageProps) {
  const { formId } = await params;
  const { zone: zoneId } = await searchParams;

  const form = await getFormWithFlow(formId);
  if (!form) notFound();

  // FIX: questions is a JSON *string* of CanvasStep[] — not a CanvasFlow object
  // Parse it and wrap into the CanvasFlow shape FlowPlayer expects
  let steps;
  try {
    steps =
      typeof form.questions === "string"
        ? JSON.parse(form.questions)
        : form.questions;
  } catch {
    notFound();
  }

  if (!steps || !Array.isArray(steps) || steps.length === 0) notFound();

  // Wrap the steps array into the CanvasFlow shape
  const flow: CanvasFlow = {
    id: form.id,
    name: form.name,
    steps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const products = form.store_id ? await getStoreProducts(form.store_id) : [];

  return (
    <FlowPlayer
      flow={flow}
      formId={formId}
      storeId={form.store_id ?? undefined}
      allProducts={products}
      redemptionCode={form.perk ?? undefined}
      isPreview={false}
      showBanner={false}
      allowReset={false}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { formId } = await params;
  const supabase = await createClient();

  const { data } = await (supabase as any)
    .from("forms")
    .select("name")
    .eq("id", formId)
    .single();

  return {
    title: data?.name ?? "Quiz",
    description:
      "Complete this short quiz to get personalised recommendations.",
  };
}
