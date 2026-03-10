import { supabase } from "@/integrations/supabase/client";
import { CustomerTag } from "@/types/mirour";

/**
 * Appends a tag to a customer's profile or an anonymous session.
 */
export const appendTag = async (
  storeId: string,
  sessionId: string,
  tagId: string,
  source: string,
  customerId?: string,
): Promise<CustomerTag | null> => {
  try {
    const { data, error } = await supabase
      .from("customer_tags")
      .insert({
        store_id: storeId,
        session_id: sessionId,
        tag_id: tagId,
        source,
        customer_id: customerId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error appending tag:", error);
      return null;
    }

    return data as CustomerTag;
  } catch (error) {
    console.error("Error in appendTag:", error);
    return null;
  }
};

/**
 * Appends multiple tags at once.
 */
export const appendTags = async (
  storeId: string,
  sessionId: string,
  tagIds: string[],
  source: string,
  customerId?: string,
): Promise<CustomerTag[]> => {
  if (!tagIds || tagIds.length === 0) return [];

  try {
    const records = tagIds.map((tagId) => ({
      store_id: storeId,
      session_id: sessionId,
      tag_id: tagId,
      source,
      customer_id: customerId || null,
    }));

    const { data, error } = await supabase
      .from("customer_tags")
      .insert(records)
      .select();

    if (error) {
      console.error("Error appending tags:", error);
      return [];
    }

    return data as CustomerTag[];
  } catch (error) {
    console.error("Error in appendTags:", error);
    return [];
  }
};

/**
 * Retrieves all tags for a given session.
 */
export const getSessionTags = async (
  storeId: string,
  sessionId: string,
): Promise<CustomerTag[]> => {
  try {
    const { data, error } = await supabase
      .from("customer_tags")
      .select("*")
      .eq("store_id", storeId)
      .eq("session_id", sessionId);

    if (error) {
      console.error("Error getting session tags:", error);
      return [];
    }

    return data as CustomerTag[];
  } catch (error) {
    console.error("Error in getSessionTags:", error);
    return [];
  }
};

/**
 * Retrieves all historical tags for a known customer.
 */
export const getCustomerTags = async (
  storeId: string,
  customerId: string,
): Promise<CustomerTag[]> => {
  try {
    const { data, error } = await supabase
      .from("customer_tags")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error getting customer tags:", error);
      return [];
    }

    return data as CustomerTag[];
  } catch (error) {
    console.error("Error in getCustomerTags:", error);
    return [];
  }
};
