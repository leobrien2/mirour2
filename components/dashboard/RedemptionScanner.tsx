"use client";

import { useState } from "react";
import { DashboardForm } from "@/types/dashboard";
import { QrCode, CheckCircle2, XCircle, List, Clock } from "lucide-react";
import { formatInStoreTime } from "@/lib/utils";

type RedemptionScannerProps = {
  forms: DashboardForm[];
  onRedeem: (redemptionCode: string) => Promise<void>;
};

export function RedemptionScanner({ forms, onRedeem }: RedemptionScannerProps) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    perk?: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  const handleScan = async () => {
    if (!code.trim()) {
      setResult({ success: false, message: "Please enter a redemption code" });
      return;
    }

    setIsProcessing(true);

    // Find the response with this redemption code
    let found = false;
    for (const form of forms) {
      const response = form.responses.find(
        (r) => r.redemptionCode === code.trim().toUpperCase(),
      );
      if (response) {
        found = true;
        if (response.perkRedeemed) {
          setResult({
            success: false,
            message: "This perk has already been redeemed",
          });
        } else {
          await onRedeem(response.redemptionCode);
          setResult({
            success: true,
            message: "Perk redeemed successfully!",
            perk: form.perk,
          });
          setCode("");
        }
        break;
      }
    }

    if (!found) {
      setResult({
        success: false,
        message: "Invalid redemption code",
      });
    }

    setIsProcessing(false);
  };

  // Get list of pending redemptions
  const pendingRedemptions = forms
    .flatMap((form) =>
      form.responses
        .filter((r) => !r.perkRedeemed)
        .map((r) => ({
          code: r.redemptionCode,
          perk: form.perk,
          formName: form.name,
          submittedAt: r.submittedAt,
          customerName: r.customerName,
          redeemed: false,
        })),
    )
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );

  // Get all redemptions (both redeemed and pending)
  const allRedemptions = forms
    .flatMap((form) =>
      form.responses.map((r) => ({
        code: r.redemptionCode,
        perk: form.perk,
        formName: form.name,
        submittedAt: r.submittedAt,
        customerName: r.customerName,
        redeemed: r.perkRedeemed,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );

  const formatDate = (date: Date) => {
    return formatInStoreTime(date);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Scanner */}
      <div className="bg-card rounded-3xl shadow-xl shadow-primary/10 border-2 border-primary/10 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-8 border-b border-primary/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <QrCode className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-foreground mb-1">
                Enter Reward Code
              </h2>
              <p className="text-muted-foreground text-sm">
                Enter customer's redemption code to validate perk
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="flex-1 px-4 sm:px-6 py-4 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary transition-all text-center tracking-[0.2em] sm:tracking-[0.3em] uppercase text-lg sm:text-xl bg-card"
              placeholder="ENTER CODE"
            />
            <button
              onClick={handleScan}
              disabled={isProcessing}
              className="px-6 sm:px-8 py-4 bg-foreground text-background rounded-2xl hover:opacity-90 hover:shadow-xl hover:shadow-foreground/30 transition-all whitespace-nowrap disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : "Redeem"}
            </button>
          </div>

          {result && (
            <div
              className={`p-6 rounded-2xl flex items-start gap-4 animate-fade-in ${
                result.success
                  ? "bg-green-50 border-2 border-green-200"
                  : "bg-destructive/10 border-2 border-destructive/20"
              }`}
            >
              {result.success ? (
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-destructive rounded-xl flex items-center justify-center flex-shrink-0">
                  <XCircle className="w-6 h-6 text-destructive-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p
                  className={`text-lg mb-1 ${result.success ? "text-green-900" : "text-destructive"}`}
                >
                  {result.message}
                </p>
                {result.perk && (
                  <div className="bg-card rounded-xl p-3 mt-2">
                    <p className="text-green-700">
                      <span className="text-green-600">Perk:</span>{" "}
                      <strong>{result.perk}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Redemptions List with Tabs */}
      <div className="bg-card rounded-3xl shadow-xl shadow-primary/10 border-2 border-primary/10 overflow-hidden animate-scale-in stagger-1">
        {/* Tab Header */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                activeTab === "pending"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              <Clock className="w-4 h-4" />
              Available ({pendingRedemptions.length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                activeTab === "all"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              <List className="w-4 h-4" />
              All ({allRedemptions.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "pending" ? (
            pendingRedemptions.length > 0 ? (
              <div className="space-y-3">
                {pendingRedemptions.map((item, index) => (
                  <div
                    key={index}
                    className="p-5 bg-secondary rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="px-4 py-2 bg-card rounded-xl tracking-[0.2em] text-primary border-2 border-primary/20">
                          {item.code}
                        </span>
                      </div>
                      {item.customerName && (
                        <p className="text-sm text-foreground mb-1">
                          {item.customerName}
                        </p>
                      )}
                      <p className="text-foreground mb-1">{item.perk}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.formName} • {formatDate(item.submittedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setCode(item.code);
                      }}
                      className="px-5 py-3 bg-foreground text-background rounded-2xl hover:opacity-90 hover:shadow-lg transition-all text-sm flex-shrink-0 w-full sm:w-auto"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-foreground mb-2">No pending redemptions</p>
                <p className="text-sm text-muted-foreground">
                  All perks have been claimed
                </p>
              </div>
            )
          ) : allRedemptions.length > 0 ? (
            <div className="space-y-3">
              {allRedemptions.map((item, index) => (
                <div
                  key={index}
                  className={`p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 transition-colors ${
                    item.redeemed
                      ? "bg-muted"
                      : "bg-secondary hover:bg-primary/5"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span
                        className={`px-4 py-2 rounded-xl tracking-[0.2em] border-2 ${
                          item.redeemed
                            ? "bg-muted text-muted-foreground border-muted-foreground/20 line-through"
                            : "bg-card text-primary border-primary/20"
                        }`}
                      >
                        {item.code}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          item.redeemed
                            ? "bg-muted-foreground/20 text-muted-foreground"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.redeemed ? "Redeemed" : "Pending"}
                      </span>
                    </div>
                    {item.customerName && (
                      <p
                        className={`text-sm mb-1 ${item.redeemed ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {item.customerName}
                      </p>
                    )}
                    <p
                      className={`mb-1 ${item.redeemed ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      {item.perk}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.formName} • {formatDate(item.submittedAt)}
                    </p>
                  </div>
                  {!item.redeemed && (
                    <button
                      onClick={() => {
                        setCode(item.code);
                      }}
                      className="px-5 py-3 bg-foreground text-background rounded-2xl hover:opacity-90 hover:shadow-lg transition-all text-sm flex-shrink-0 w-full sm:w-auto"
                    >
                      Select
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <List className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground mb-2">No redemptions yet</p>
              <p className="text-sm text-muted-foreground">
                Redemptions will appear here once customers submit forms
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
