"use client";

import { DashboardForm } from "@/types/dashboard";
import { QRCodeDisplay } from "./QRCodeDisplay";
import {
  FileText,
  QrCode,
  ExternalLink,
  Trash2,
  Pencil,
  Plus,
  LayoutGrid,
  List,
  Eye,
  Calendar,
  MessageSquare,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { formatInStoreTime } from "@/lib/utils";
import { trackEvent } from "@/lib/mixpanel";

type ViewMode = "grid" | "table";

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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mb-5">
          <FileText className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No flows yet
        </h3>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm">
          Create your first flow to start engaging customers and collecting
          responses.
        </p>
        <button
          onClick={() => {
            trackEvent("Create Flow Start Clicked", {
              location: "Empty State Button",
            });
            onCreateForm();
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-sm font-medium rounded-xl hover:opacity-80 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create Flow
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="">
          <h1 className="text-2xl font-semibold text-foreground">Flows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your customer engagement flows
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg px-3 py-1 gap-2">
            <p className="text-sm text-muted-foreground">
              {forms.length} flow{forms.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Create button */}
          <button
            onClick={() => {
              trackEvent("Create Flow Start Clicked", { location: "Toolbar" });
              onCreateForm();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-sm font-medium rounded-xl hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New Flow
          </button>
        </div>
      </div>

      {/* ── Grid View ── */}
      {viewMode === "grid" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => {
            const responseCount = form.responses.length;
            const isQROpen = selectedFormId === form.id;

            return (
              <div
                key={form.id}
                className={`group relative bg-card border rounded-2xl overflow-hidden transition-all hover:shadow-md ${
                  form.active ? "border-border" : "border-border/50 opacity-60"
                }`}
              >
                {/* Card Header */}
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate leading-snug">
                        {form.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatInStoreTime(form.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        form.active
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {form.active ? "Live" : "Off"}
                    </span>
                  </div>

                  {/* Metric */}
                  <button
                    onClick={() => onViewResponses?.(form.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 bg-muted/60 hover:bg-muted rounded-xl transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground leading-none">
                        {responseCount}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Responses
                      </p>
                    </div>
                  </button>
                </div>

                {/* Card Actions */}
                <div className="px-5 pb-4 flex items-center gap-2">
                  <a
                    href={`/f/${form.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-foreground bg-muted/60 hover:bg-muted rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View
                  </a>
                  <button
                    onClick={() => setSelectedFormId(isQROpen ? null : form.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-foreground bg-muted/60 hover:bg-muted rounded-lg transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR
                  </button>
                  {onEditForm && (
                    <button
                      onClick={() => onEditForm(form.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-foreground bg-muted/60 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                  {onToggleFormActive && (
                    <div className="flex items-center" title={form.active ? "Deactivate" : "Activate"}>
                      <Switch
                        checked={form.active}
                        onCheckedChange={() => onToggleFormActive(form.id)}
                      />
                    </div>
                  )}
                  {onDeleteForm && (
                    <button
                      onClick={() => setDeleteConfirmId(form.id)}
                      className="p-2 text-muted-foreground hover:text-destructive bg-muted/60 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* QR Expand */}
                {isQROpen && (
                  <div className="px-5 pb-5 border-t border-border pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground">
                        Scan to open flow
                      </p>
                      <button
                        onClick={() => setSelectedFormId(null)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <QRCodeDisplay
                      value={form.id}
                      formData={form}
                      businessName={businessName}
                      businessLogo={businessLogo}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table View ── */}
      {viewMode === "table" && (
        <div className="border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Responses
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {forms.map((form) => (
                <>
                  <tr
                    key={form.id}
                    className={`group hover:bg-muted/30 transition-colors ${
                      !form.active ? "opacity-50" : ""
                    }`}
                  >
                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground truncate max-w-[180px]">
                        {form.name}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          form.active
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {form.active ? "Live" : "Off"}
                      </span>
                    </td>

                    {/* Responses */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onViewResponses?.(form.id)}
                        className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold">
                          {form.responses.length}
                        </span>
                      </button>
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                      {formatInStoreTime(form.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/f/${form.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                          title="View live"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() =>
                            setSelectedFormId(
                              selectedFormId === form.id ? null : form.id,
                            )
                          }
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                          title="QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        {onEditForm && (
                          <button
                            onClick={() => onEditForm(form.id)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onToggleFormActive && (
                          <div className="px-1.5" title={form.active ? "Deactivate" : "Activate"}>
                            <Switch
                              checked={form.active}
                              onCheckedChange={() => onToggleFormActive(form.id)}
                              className="scale-75"
                            />
                          </div>
                        )}
                        {onDeleteForm && (
                          <button
                            onClick={() => setDeleteConfirmId(form.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* QR row expander in table view */}
                  {selectedFormId === form.id && (
                    <tr key={`${form.id}-qr`} className="bg-muted/20">
                      <td colSpan={5} className="px-5 py-4">
                        <div className="flex items-start gap-6">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-3">
                              Scan to open flow
                            </p>
                            <QRCodeDisplay
                              value={form.id}
                              formData={form}
                              businessName={businessName}
                              businessLogo={businessLogo}
                            />
                          </div>
                          <button
                            onClick={() => setSelectedFormId(null)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors mt-0.5"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 bg-destructive/10 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 className="w-4.5 h-4.5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Delete flow?
                </h3>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. All responses will be
                  permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteForm?.(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-xl transition-colors"
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
