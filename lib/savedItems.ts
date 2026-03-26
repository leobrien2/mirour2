import { supabase } from "@/integrations/supabase/client";
import { SavedItem } from "@/types/mirour";

export const saveItem = async (
  sessionId: string,
  productId: string,
  storeId?: string | null,
  customerId?: string,
): Promise<SavedItem | null> => {
  try {
    if (customerId) {
      const { data: existing } = await supabase
        .from("saved_items")
        .select(
          `
          id, store_id, customer_id, session_id, product_id, created_at, purchased_at,
          products ( id, name, price, imageurl, description, sku )
        `,
        )
        .eq("customer_id", customerId)
        .eq("product_id", productId)
        .maybeSingle();
      if (existing) return existing as unknown as SavedItem;
    }

    const { data, error } = await supabase
      .from("saved_items")
      .insert({
        store_id: storeId ?? null,
        session_id: sessionId,
        product_id: productId,
        customer_id: customerId ?? null,
      } as any)
      .select(
        `
        id, store_id, customer_id, session_id, product_id, created_at, purchased_at,
        products ( id, name, price, imageurl, description, sku )
      `,
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        // Race condition: already saved — fetch and return the existing row
        const { data: existing } = customerId
          ? await supabase
              .from("saved_items")
              .select(
                "*, products(id, name, price, imageurl, description, sku)",
              )
              .eq("customer_id", customerId)
              .eq("product_id", productId)
              .maybeSingle()
          : await supabase
              .from("saved_items")
              .select(
                "*, products(id, name, price, imageurl, description, sku)",
              )
              .eq("session_id", sessionId)
              .eq("product_id", productId)
              .is("customer_id", null)
              .maybeSingle();
        return existing as unknown as SavedItem | null;
      }
      console.error("Error saving item:", error);
      return null;
    }

    return data as unknown as SavedItem;
  } catch (error) {
    console.error("Error in saveItem:", error);
    return null;
  }
};

export const unsaveItem = async (
  sessionId: string,
  productId: string,
  customerId?: string,
): Promise<boolean> => {
  try {
    let query = supabase
      .from("saved_items")
      .delete()
      .eq("product_id", productId);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    } else {
      query = query.eq("session_id", sessionId).is("customer_id", null);
    }

    const { error } = await query;
    if (error) {
      console.error("Error unsaving item:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error in unsaveItem:", error);
    return false;
  }
};

export const getSavedItems = async (
  sessionId: string,
  customerId?: string,
): Promise<SavedItem[]> => {
  try {
    let query = supabase
      .from("saved_items")
      .select(
        `
        id, store_id, customer_id, session_id, product_id, created_at, purchased_at,
        products ( id, name, price, image_url, description, sku )
      `,
      )
      .order("created_at", { ascending: false });

    if (customerId) {
      query = query.eq("customer_id", customerId);
    } else {
      query = query.eq("session_id", sessionId).is("customer_id", null);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error getting saved items:", error);
      return [];
    }
    return (data ?? []) as unknown as SavedItem[];
  } catch (error) {
    console.error("Error in getSavedItems:", error);
    return [];
  }
};

export const linkSavedItemsToCustomer = async (
  sessionId: string,
  customerId: string,
): Promise<boolean> => {
  try {
    // 1. Find products this customer already has saved (dedup guard)
    const { data: customerExisting, error: existingError } = await supabase
      .from("saved_items")
      .select("product_id")
      .eq("customer_id", customerId);

    if (existingError) {
      console.error("Error fetching existing customer saves:", existingError);
      return false;
    }

    const alreadySaved = new Set<string>(
      (customerExisting ?? []).map((r: any) => r.product_id),
    );

    // 2. Delete session rows that would violate unique constraint
    if (alreadySaved.size > 0) {
      const { error: deleteError } = await supabase
        .from("saved_items")
        .delete()
        .eq("session_id", sessionId)
        .is("customer_id", null)
        .in("product_id", Array.from(alreadySaved));

      if (deleteError) {
        console.error("Error deleting duplicate session saves:", deleteError);
        return false;
      }
    }

    // 3. Migrate remaining session rows to the customer
    const { error } = await supabase
      .from("saved_items")
      .update({ customer_id: customerId } as any)
      .eq("session_id", sessionId)
      .is("customer_id", null);

    if (error) {
      console.error("Error linking saved items:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error in linkSavedItemsToCustomer:", error);
    return false;
  }
};
