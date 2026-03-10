import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Response as MirourResponse } from "@/types/mirour";
import { useToast } from "./use-toast";

export function useResponses() {
  const { toast } = useToast();
  const [responses, setResponses] = useState<MirourResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResponses = async (formId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("responses")
      .select("*")
      .eq("form_id", formId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching responses:", error);
      toast({
        title: "Error",
        description: "Failed to load responses",
        variant: "destructive",
      });
      setResponses([]);
    } else {
      // Cast answers from Json to Record<string, any>
      const parsedData = (data || []).map((r) => ({
        ...r,
        answers: (r.answers as Record<string, any>) || {},
        customer_name: r.customer_name ?? undefined,
        customer_email: r.customer_email ?? undefined,
        customer_phone: r.customer_phone ?? undefined,
        additional_feedback: r.additional_feedback ?? undefined,
      }));
      setResponses(parsedData);
    }
    setLoading(false);
    return data || [];
  };

  const submitResponse = async (responseData: {
    form_id: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    answers: Record<string, any>;
    redemption_code: string;
    additional_feedback?: string;
  }) => {
    const { data, error } = await supabase
      .from("responses")
      .insert(responseData)
      .select()
      .single();

    if (error) {
      console.error("Error submitting response:", error);
      return { error: new Error(error.message), data: null };
    }

    return { error: null, data };
  };

  const markAsRedeemed = async (responseId: string) => {
    const { error } = await supabase
      .from("responses")
      .update({ perk_redeemed: true })
      .eq("id", responseId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark as redeemed",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    setResponses((prev) =>
      prev.map((r) =>
        r.id === responseId ? { ...r, perk_redeemed: true } : r,
      ),
    );

    toast({
      title: "Success",
      description: "Perk marked as redeemed",
    });

    return { error: null };
  };

  const deleteResponse = async (responseId: string) => {
    const { error } = await supabase
      .from("responses")
      .delete()
      .eq("id", responseId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete response",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    setResponses((prev) => prev.filter((r) => r.id !== responseId));

    return { error: null };
  };

  const updateResponseCustomerInfo = async (
    responseId: string,
    updates: {
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
    },
  ) => {
    const { error } = await supabase
      .from("responses")
      .update(updates)
      .eq("id", responseId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update customer info",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    setResponses((prev) =>
      prev.map((r) => (r.id === responseId ? { ...r, ...updates } : r)),
    );

    toast({
      title: "Success",
      description: "Customer info updated",
    });

    return { error: null };
  };

  const findByRedemptionCode = async (code: string) => {
    const { data, error } = await supabase
      .from("responses")
      .select("*, forms!inner(name, perk, owner_id)")
      .eq("redemption_code", code)
      .maybeSingle();

    if (error) {
      console.error("Error finding redemption code:", error);
      return { error: new Error(error.message), data: null };
    }

    return { error: null, data };
  };

  const redeemByCode = async (code: string) => {
    const { error } = await supabase
      .from("responses")
      .update({ perk_redeemed: true })
      .eq("redemption_code", code);

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  };

  return {
    responses,
    loading,
    fetchResponses,
    submitResponse,
    markAsRedeemed,
    deleteResponse,
    updateResponseCustomerInfo,
    findByRedemptionCode,
    redeemByCode,
  };
}
