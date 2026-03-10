import { supabase } from "@/integrations/supabase/client";
import { Interaction, InteractionEventType } from "@/types/mirour";

/**
 * Logs a customer interaction for analytics and conversion tracking.
 * @param storeId The ID of the store
 * @param sessionId The current session ID (anonymous or otherwise)
 * @param eventType The type of event (e.g., qr_scan, product_shown)
 * @param metadata Additional JSON metadata about the event
 * @param customerId Optional customer ID if they are known
 */
export const logInteraction = async (
  storeId: string,
  sessionId: string,
  eventType: InteractionEventType | string,
  metadata?: Record<string, any>,
  customerId?: string,
): Promise<Interaction | null> => {
  try {
    const { data, error } = await supabase
      .from("interactions")
      .insert({
        store_id: storeId,
        session_id: sessionId,
        event_type: eventType,
        metadata: metadata || {},
        customer_id: customerId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error logging interaction:", error);
      return null;
    }

    return data as Interaction;
  } catch (err) {
    console.error("Error in logInteraction:", err);
    return null;
  }
};
