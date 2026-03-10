"use client";

import { DashboardForm } from "@/types/dashboard";
import { QRCodeDisplay } from "./QRCodeDisplay";
import { WorkspaceMetrics } from "./WorkspaceMetrics";
import {
  FileText,
  QrCode,
  ExternalLink,
  Trash2,
  Pencil,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { formatInStoreTime } from "@/lib/utils";
import { trackEvent } from "@/lib/mixpanel";

type FormsListProps = {
  forms: DashboardForm[];
  onCreateForm: () => void;
  onViewResponses?: (formId: string, searchQuery?: string) => void;
  onToggleFormActive?: (formId: string) => void;
  onDeleteForm?: (formId: string) => void;
  onEditForm?: (formId: string) => void;
  businessName?: string;
  businessLogo?: string | null;
};

export function FormsList({
  forms,
  onCreateForm,
  onViewResponses,
  onToggleFormActive,
  onDeleteForm,
  onEditForm,
  businessName,
  businessLogo,
}: FormsListProps) {
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteClick = (formId: string) => {
    setDeleteConfirmId(formId);
  };

  const confirmDelete = (formId: string) => {
    onDeleteForm?.(formId);
    setDeleteConfirmId(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  if (forms.length === 0) {
    return (
      <div className="bg-card rounded-3xl shadow-2xl shadow-primary/10 border-2 border-primary/10 p-16 text-center animate-scale-in">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center mx-auto mb-6">
          <FileText className="w-10 h-10 text-primary-foreground" />
        </div>
        <h3 className="font-heading text-foreground mb-3">No flows yet</h3>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Create your first flow to start engaging customers and rewarding your
          customers
        </p>
        <button
          onClick={() => {
            trackEvent("Create Flow Start Clicked", {
              location: "Empty State Button",
            });
            onCreateForm();
          }}
          className="px-8 py-3 bg-foreground text-background rounded-2xl hover:opacity-90 hover:shadow-lg transition-all"
        >
          Create Flow
        </button>
      </div>
    );
  }

  return (
    <>
      {/* <WorkspaceMetrics forms={forms} /> */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Create Flow Card */}
        <button
          onClick={() => {
            trackEvent("Create Flow Start Clicked", { location: "Grid Card" });
            onCreateForm();
          }}
          className="bg-card rounded-3xl shadow-xl shadow-primary/10 border-2 border-dashed border-primary/30 overflow-hidden hover:shadow-2xl hover:shadow-primary/20 hover:border-primary transition-all animate-scale-in flex flex-col items-center justify-center min-h-[200px] group"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-8 h-8 text-primary-foreground" />
          </div>
          <span className="text-lg font-medium text-foreground">
            Create Flow
          </span>
          <span className="text-sm text-muted-foreground mt-1">
            Build customer touchpoints
          </span>
        </button>

        {forms.map((form, index) => {
          const responseCount = form.responses.length;

          return (
            <div
              key={form.id}
              className={`bg-card rounded-3xl shadow-xl shadow-primary/10 border-2 overflow-hidden hover:shadow-2xl transition-all animate-scale-in stagger-${Math.min(index + 1, 5)} relative ${
                form.active
                  ? "border-primary/10 hover:shadow-primary/20"
                  : "border-muted-foreground/20 bg-muted/30"
              }`}
            >
              {/* Top Right Edit Button */}
              {onEditForm && (
                <button
                  onClick={() => onEditForm(form.id)}
                  className="absolute top-4 right-4 z-10 p-2 bg-card text-foreground rounded-xl border-2 border-primary/30 hover:border-primary hover:shadow-lg transition-all"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              {/* Inactive Badge */}
              {!form.active && (
                <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-muted-foreground text-muted rounded-full text-xs font-medium uppercase tracking-wide">
                  Inactive
                </div>
              )}

              {/* Header */}
              <div
                className={`p-6 pr-16 ${!form.active ? "pt-12" : ""} border-b ${form.active ? "border-primary/10" : "border-muted-foreground/20"}`}
              >
                <h3
                  className={`font-heading mb-2 text-xl ${form.active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {form.name}
                </h3>
                <p
                  className={`text-sm ${form.active ? "text-muted-foreground" : "text-muted-foreground/70"}`}
                >
                  Created {formatInStoreTime(form.createdAt)}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Stats */}
                <button
                  onClick={() => onViewResponses?.(form.id)}
                  className="w-full bg-secondary rounded-2xl p-4 hover:bg-primary/10 transition-colors"
                >
                  <div className="text-2xl text-primary mb-1">
                    {responseCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Responses</div>
                </button>

                {/* Actions */}
                <div className="flex gap-2">
                  <a
                    href={`/start?form=${form.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 bg-card text-foreground rounded-2xl border-2 border-primary/30 hover:border-primary hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View
                  </a>
                  <button
                    onClick={() =>
                      setSelectedFormId(
                        selectedFormId === form.id ? null : form.id,
                      )
                    }
                    className="flex-1 py-3 px-4 bg-card text-foreground rounded-2xl border-2 border-primary/30 hover:border-primary hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    {selectedFormId === form.id ? "Hide" : "QR"}
                  </button>
                  {onToggleFormActive && (
                    <button
                      onClick={() => onToggleFormActive(form.id)}
                      className={`flex-1 py-3 px-4 rounded-2xl border-2 hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                        form.active
                          ? "bg-foreground text-background border-foreground hover:opacity-90"
                          : "bg-card text-muted-foreground border-primary/30 hover:border-primary"
                      }`}
                    >
                      {form.active ? "Active" : "Inactive"}
                    </button>
                  )}
                </div>

                {/* QR Code Display */}
                {selectedFormId === form.id && (
                  <div className="pt-4 border-t-2 border-primary/10 animate-fade-in">
                    <p className="text-sm text-muted-foreground mb-4 text-center">
                      Customers scan this to access your flow
                    </p>
                    <QRCodeDisplay
                      value={form.id}
                      formData={form}
                      businessName={businessName}
                      businessLogo={businessLogo}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="font-heading text-2xl text-foreground mb-2">
                Delete Flow?
              </h3>
              <p className="text-muted-foreground">
                Are you sure you want to delete this flow? This action cannot be
                undone and all responses will be lost.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 py-3 px-6 bg-card text-foreground rounded-2xl border-2 border-primary/30 hover:border-primary hover:shadow-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirmId)}
                className="flex-1 py-3 px-6 bg-destructive text-destructive-foreground rounded-2xl hover:opacity-90 hover:shadow-lg transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
