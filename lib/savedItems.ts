import { supabase } from "@/integrations/supabase/client";
import { SavedItem } from "@/types/mirour";

/**
 * Saves a product for the current session or customer.
 */
export const saveItem = async (
  storeId: string,
  sessionId: string,
  productId: string,
  customerId?: string,
): Promise<SavedItem | null> => {
  try {
    // Avoid duplicates if customerId is known
    if (customerId) {
      const { data: existing } = await supabase
        .from("saved_items")
        .select("id")
        .eq("store_id", storeId)
        .eq("customer_id", customerId)
        .eq("product_id", productId)
        .maybeSingle();

      if (existing) {
        return existing as SavedItem; // Already saved
      }
    }

    const { data, error } = await supabase
      .from("saved_items")
      .insert({
        store_id: storeId,
        session_id: sessionId,
        product_id: productId,
        customer_id: customerId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving item:", error);
      return null;
    }

    return data as SavedItem;
  } catch (error) {
    console.error("Error in saveItem:", error);
    return null;
  }
};

/**
 * Removes a saved item. For anonymous users, checks sessionId. For known users, checks customerId.
 */
export const unsaveItem = async (
  storeId: string,
  sessionId: string,
  productId: string,
  customerId?: string,
): Promise<boolean> => {
  try {
    let query = supabase
      .from("saved_items")
      .delete()
      .eq("store_id", storeId)
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

/**
 * Gets all saved items for a session or a known customer.
 */
export const getSavedItems = async (
  storeId: string,
  sessionId: string,
  customerId?: string,
): Promise<SavedItem[]> => {
  try {
    let query = supabase
      .from("saved_items")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    // If customer is known, fetch all their saved items.
    // Otherwise, fetch just the items saved in this anonymous session.
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

    return data as SavedItem[];
  } catch (error) {
    console.error("Error in getSavedItems:", error);
    return [];
  }
};
