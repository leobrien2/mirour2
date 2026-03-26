// services/customerLookup.ts
import { supabase } from "@/integrations/supabase/client";
import { LocalCustomerProfile } from "@/lib/customerSession";

export const lookupCustomerByPhone = async (
  phone: string,
): Promise<LocalCustomerProfile | null> => {

    console.log("phone", phone);
  const { data, error } = await (supabase as any)
    .from("customers")
    .select("id, name, first_name, email, phone")
    .eq("phone", phone.trim())
    .maybeSingle();


    console.log("data", data);
    console.log("error", error);

  if (error || !data) return null;
  return data as LocalCustomerProfile;
};

export interface CustomerHistory {
  savedItems: any[];
  responses: {
    id: string;
    submittedat: string;
    redemptioncode: string;
    perkredeemed: boolean;
    answers: Record<string, any>;
    forms: { name: string } | null;
  }[];
}

export const getCustomerHistory = async (
  customerId: string,
): Promise<CustomerHistory> => {
  const [savedRes, responsesRes] = await Promise.all([
    (supabase as any)
      .from("saved_items")
      .select("*, products(id, name, price, imageurl, sku)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),

    (supabase as any)
      .from("responses")
      .select(
        "id, submittedat, redemptioncode, perkredeemed, answers, forms(name)",
      )
      .eq("customerid", customerId)
      .order("submittedat", { ascending: false }),
  ]);

  return {
    savedItems: savedRes.data ?? [],
    responses: responsesRes.data ?? [],
  };
};
