import { useState, useEffect } from "react";
import { FileText, Store, Sparkles, Wand2 } from "lucide-react";
import { Store as StoreType, Zone, Tag } from "@/types/mirour";
import {
  createEntranceFlowTemplate,
  createZoneFlowTemplate,
} from "@/lib/flowTemplates";
import { createStandardSoberishTags } from "@/lib/bulkTagHelpers";
import { useStores } from "@/hooks/useStores";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/mixpanel";

type CreateFormSimpleProps = {
  stores: StoreType[];
  onCreateForm: (formData: {
    name: string;
    internal_goal?: string;
    questions: any[];
    perk: string;
    capture_name: boolean;
    capture_email: boolean;
    capture_phone: boolean;
    show_start_page?: boolean;
    store_id?: string;
    flow_type?: "standard" | "entrance" | "zone";
    zone_id?: string;
  }) => Promise<{ error: Error | null; data: any }>;
  onSuccess: (formId: string) => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};

export function CreateFormSimple({
  stores,
  onCreateForm,
  onSuccess,
  onCancel,
  onDirtyChange,
}: CreateFormSimpleProps) {
  const [formName, setFormName] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateType, setTemplateType] = useState<"entrance" | "zone">(
    "entrance",
  );
  const [showStartPage, setShowStartPage] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [isCreatingTags, setIsCreatingTags] = useState(false);
  const [quickSetupStatus, setQuickSetupStatus] = useState<string>("");

  const { zones, tags } = useStores();
  const storeZones = zones.filter((z) => z.store_id === selectedStoreId);
  const selectedZone = storeZones.find((z) => z.id === selectedZoneId);

  // Removed auto-select first store so that it defaults to no location.
  useEffect(() => {
    // No auto-select logic
  }, []);

  const handleQuickSetup = async () => {
    if (!selectedStoreId) {
      alert("Please select a location first.");
      return;
    }

    setIsCreatingTags(true);
    setQuickSetupStatus("Creating 14 standard tags...");

    try {
      const result = await createStandardSoberishTags(
        supabase,
        selectedStoreId,
      );

      if (result.errors.length > 0) {
        setQuickSetupStatus(
          `⚠️ Completed with errors:\n${result.created} created, ${result.skipped} skipped\nErrors: ${result.errors.join(", ")}`,
        );
      } else if (result.created > 0) {
        setQuickSetupStatus(
          `✓ Created ${result.created} tags${result.skipped > 0 ? ` (${result.skipped} already existed)` : ""}`,
        );
        trackEvent("Quick Setup Tags Completed", {
          storeId: selectedStoreId,
          created: result.created,
          skipped: result.skipped,
        });
      } else {
        setQuickSetupStatus(`✓ All ${result.skipped} tags already exist`);
        trackEvent("Quick Setup Tags Completed", {
          storeId: selectedStoreId,
          created: result.created,
          skipped: result.skipped,
        });
      }

      // Auto-clear success message after 3 seconds
      setTimeout(() => setQuickSetupStatus(""), 3000);
    } catch (error) {
      console.error("Quick setup failed:", error);
      setQuickSetupStatus("✗ Failed to create tags. See console for details.");
      setTimeout(() => setQuickSetupStatus(""), 5000);
    } finally {
      setIsCreatingTags(false);
    }
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Create form with template or default nodes
      let nodesToUse;
      let flowType: "standard" | "entrance" | "zone" = "standard";
      let zoneId: string | undefined;

      if (useTemplate) {
        try {
          if (templateType === "entrance") {
            const template = createEntranceFlowTemplate(selectedStoreId, tags);
            nodesToUse = template.nodes;
            flowType = "entrance";
          } else if (templateType === "zone" && selectedZone) {
            const template = createZoneFlowTemplate(
              selectedStoreId,
              selectedZone,
            );
            nodesToUse = template.nodes;
            flowType = "zone";
            zoneId = selectedZone.id;
          } else {
            alert("Please select a zone for zone flow template");
            setIsSubmitting(false);
            return;
          }
        } catch (templateError) {
          // Template validation failed - show user-friendly error
          const errorMessage =
            templateError instanceof Error
              ? templateError.message
              : "Unknown error occurred";
          alert(`Failed to create flow template:\n\n${errorMessage}`);
          setIsSubmitting(false);
          return;
        }
      } else {
        // Default welcome and complete nodes
        nodesToUse = [
          {
            id: "node-" + Math.random().toString(36).substring(2, 9),
            type: "welcome",
            content: "Welcome! We'd love your feedback.",
            buttonText: "Get Started",
          },
          {
            id: "node-" + Math.random().toString(36).substring(2, 9),
            type: "complete",
            content: "Thank you for your feedback!",
            hasPerk: false,
            perk: "",
          },
        ];
      }

      const { error, data } = await onCreateForm({
        name: formName,
        questions: nodesToUse,
        perk: "",
        capture_name: false,
        capture_email: false,
        capture_phone: false,
        show_start_page: showStartPage,
        store_id: selectedStoreId || undefined,
        flow_type: flowType,
        zone_id: zoneId,
      });

      if (error) throw error;

      trackEvent("Form Created", {
        formName,
        storeId: selectedStoreId,
        flowType,
        useTemplate,
        zoneId: zoneId,
      });

      onSuccess(data.id);
    } catch (error) {
      console.error("Failed to create form:", error);
      alert("Failed to create form. Please check the console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="bg-card rounded-3xl shadow-2xl shadow-primary/10 border-2 border-primary/10 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Create New Flow
          </h2>
          <p className="text-muted-foreground text-sm">
            Link this flow to a store to enable product recommendations.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Flow Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                onDirtyChange?.(true);
              }}
              placeholder="e.g., Customer Feedback"
              className="w-full px-4 py-3 bg-secondary border-2 border-primary/20 rounded-2xl text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Store className="w-4 h-4" />
              Assign to Location
            </label>
            {stores.length > 0 ? (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border-2 border-primary/20 rounded-2xl text-foreground focus:border-primary focus:outline-none transition-colors appearance-none"
              >
                <option value="">No Location (Optional)</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border-2 border-primary/20 rounded-2xl text-foreground focus:border-primary focus:outline-none transition-colors appearance-none"
              >
                <option value="">No Location</option>
              </select>
            )}
          </div>

          {/* Template Toggle */}

          <div className="flex items-center justify-between bg-secondary p-4 rounded-2xl border-2 border-primary/20">
            <div>
              <p className="font-medium text-foreground">Show Start Page</p>
              <p className="text-sm text-muted-foreground">
                Show welcome screen before the flow starts
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showStartPage}
                onChange={(e) => {
                  setShowStartPage(e.target.checked);
                  onDirtyChange?.(true);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-6 bg-card text-foreground rounded-2xl border-2 border-primary/30 hover:border-primary hover:shadow-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formName.trim() || isSubmitting}
              className="flex-1 py-3 px-6 bg-foreground text-background rounded-2xl hover:opacity-90 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Flow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
