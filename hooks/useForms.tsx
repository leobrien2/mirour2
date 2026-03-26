"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Form, FlowNode, FlowType } from "@/types/mirour";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

// ─── Context ──────────────────────────────────────────────────────────────

type FormsContextType = ReturnType<typeof useFormsInternal>;
const FormsContext = createContext<FormsContextType | undefined>(undefined);

export function FormsProvider({ children }: { children: React.ReactNode }) {
  const value = useFormsInternal();
  return (
    <FormsContext.Provider value={value}>{children}</FormsContext.Provider>
  );
}

export function useForms() {
  const ctx = useContext(FormsContext);
  if (!ctx) throw new Error("useForms must be used within a FormsProvider");
  return ctx;
}

// ─── Implementation ────────────────────────────────────────────────────────

function useFormsInternal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchForms = async () => {
    if (!user) {
      setForms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching forms:", error);
      toast({
        title: "Error",
        description: "Failed to load forms",
        variant: "destructive",
      });
    } else {
      // Parse questions from JSONB
      const parsedForms = (data || []).map((form) => ({
        ...form,
        store_id: form.store_id ?? undefined,
        zone_id: form.zone_id ?? undefined,
        flow_type: (form.flow_type as FlowType) ?? undefined,
        internal_goal: form.internal_goal ?? undefined,
        questions: (form.questions as unknown as FlowNode[]) || [],
      }));
      setForms(parsedForms);
    }
    setLoading(false);
  };

  const userId = user?.id;
  useEffect(() => {
    if (userId) {
      fetchForms();
    } else {
      setForms([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const createForm = async (formData: {
    name: string;
    internal_goal?: string;
    questions: FlowNode[];
    perk: string;
    capture_name: boolean;
    capture_email: boolean;
    capture_phone: boolean;
    show_start_page?: boolean;
    store_id?: string;
  }) => {
    if (!user) return { error: new Error("Not authenticated"), data: null };

    const { data, error } = await supabase
      .from("forms")
      .insert({
        owner_id: user.id,
        store_id: formData.store_id, // Link to store
        name: formData.name,
        internal_goal: formData.internal_goal,
        questions: formData.questions as unknown as any,
        perk: formData.perk,
        capture_name: formData.capture_name,
        capture_email: formData.capture_email,
        capture_phone: formData.capture_phone,
        show_start_page: formData.show_start_page ?? true,
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create form",
        variant: "destructive",
      });
      return { error: new Error(error.message), data: null };
    }

    const newForm = {
      ...data,
      store_id: data.store_id ?? undefined,
      zone_id: data.zone_id ?? undefined,
      flow_type: (data.flow_type as FlowType) ?? undefined,
      internal_goal: data.internal_goal ?? undefined,
      questions: (data.questions as unknown as FlowNode[]) || [],
    };

    setForms((prev) => [newForm, ...prev]);
    toast({
      title: "Success",
      description: "Form created successfully",
    });

    return { error: null, data: newForm };
  };

  const updateForm = async (formId: string, updates: Partial<Form>) => {
    // Save original state for possible rollback
    const originalForms = [...forms];
    
    // Optimistic update
    setForms((prev) =>
      prev.map((f) => (f.id === formId ? { ...f, ...updates } : f)),
    );

    const updateData: any = { ...updates };
    if (updates.questions) {
      updateData.questions = updates.questions as unknown as any;
    }

    const { error } = await supabase
      .from("forms")
      .update(updateData)
      .eq("id", formId);

    if (error) {
      console.error("updateForm Error:", error);
      // Rollback to original state
      setForms(originalForms);
      toast({
        title: "Error",
        description: "Failed to update form",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    return { error: null };
  };

  const deleteForm = async (formId: string) => {
    const { error } = await supabase.from("forms").delete().eq("id", formId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete form",
        variant: "destructive",
      });
      return { error: new Error(error.message) };
    }

    setForms((prev) => prev.filter((f) => f.id !== formId));
    toast({
      title: "Success",
      description: "Form deleted successfully",
    });

    return { error: null };
  };

  const toggleFormActive = async (formId: string) => {
    const form = forms.find((f) => f.id === formId);
    if (!form) return { error: new Error("Form not found") };

    return updateForm(formId, { active: !form.active });
  };

  const fetchForm = async (formId: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("id", formId)
      .single();

    if (error || !data) {
      console.error("Error fetching form:", error);
      toast({
        title: "Error",
        description: "Failed to load latest form data",
        variant: "destructive",
      });
      return null;
    }

    const parsedForm = {
      ...data,
      store_id: data.store_id ?? undefined,
      zone_id: data.zone_id ?? undefined,
      flow_type: (data.flow_type as FlowType) ?? undefined,
      internal_goal: data.internal_goal ?? undefined,
      questions: (data.questions as unknown as FlowNode[]) || [],
    };

    setForms((prev) => {
      const exists = prev.some((f) => f.id === formId);
      if (exists) {
        return prev.map((f) => (f.id === formId ? parsedForm : f));
      }
      return [parsedForm, ...prev];
    });

    return parsedForm;
  };

  return {
    forms,
    loading,
    fetchForms,
    fetchForm,
    createForm,
    updateForm,
    deleteForm,
    toggleFormActive,
  };
}
