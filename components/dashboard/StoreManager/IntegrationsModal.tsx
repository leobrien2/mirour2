"use client";

import { useState, useEffect } from "react";
import { useStores } from "@/hooks/useStores";
import { StoreIntegration } from "@/types/mirour";
import {
  X,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Webhook,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface IntegrationsModalProps {
  storeId?: string;
  onClose: () => void;
}

type Platform =
  | "squarespace"
  | "lightspeed-retail"
  | "shopify"
  | "csv_xlsx"
  | "webhook";

interface PlatformCard {
  id: Platform;
  name: string;
  description: string;
  available: boolean;
  note?: string;
  logo: React.ReactNode;
  logoColor: string;
  useOAuth: boolean;
}

const PLATFORMS: PlatformCard[] = [
  {
    id: "shopify",
    name: "Shopify",
    description: "Connect your Shopify store to sync customers automatically.",
    available: true,
    logo: "Sh",
    logoColor: "bg-green-600 text-white",
    useOAuth: true,
  },
  {
    id: "squarespace",
    name: "Squarespace",
    description: "Import products from your Squarespace Commerce store.",
    available: true,
    logo: "Sq",
    logoColor: "bg-black text-white",
    useOAuth: true,
  },
  {
    id: "lightspeed-retail",
    name: "Lightspeed",
    description: "Connect your Lightspeed POS to sync inventory.",
    note: "Requires Lightspeed Plus plan or higher",
    available: true,
    logo: "Ls",
    logoColor: "bg-red-500 text-white",
    useOAuth: true,
  },
  {
    id: "webhook",
    name: "Webhook",
    description:
      "Send data automatically to Zapier, Make, or custom endpoints.",
    available: true,
    logo: <Webhook className="w-5 h-5" />,
    logoColor: "bg-purple-600 text-white",
    useOAuth: false,
  },
  {
    id: "csv_xlsx",
    name: "CSV / Excel Upload",
    description: "Import products from a CSV, XLSX, or Shopify export.",
    available: true,
    logo: "File",
    logoColor: "bg-blue-600 text-white",
    useOAuth: false,
  },
];

export function IntegrationsModal({
  storeId,
  onClose,
}: IntegrationsModalProps) {
  const {
    integrations,
    fetchIntegrations,
    importProductsFromFile,
    connectNango,
    saveWebhookUrl,
  } = useStores();

  const [expandedPlatform, setExpandedPlatform] = useState<Platform | null>(
    null,
  );

  // ── OAuth states ──────────────────────────────────────────────────────────
  const [shopDomain, setShopDomain] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [connectError, setConnectError] = useState<string | null>(null);

  // ── Webhook states ────────────────────────────────────────────────────────
  const [webhookUrl, setWebhookUrl] = useState("");

  // ── CSV / File states ─────────────────────────────────────────────────────
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const getIntegration = (platform: Platform): StoreIntegration | undefined => {
    // If storeId is provided, we could optionally filter by it, but since integrations
    // can be global (store_id = null) OR store-specific, finding by platform usually suffices
    // for the UI state if a user only has one active integration per platform type.
    return integrations.find((i) => i.platform === platform);
  };

  const handleTogglePlatform = (platform: Platform) => {
    if (expandedPlatform === platform) {
      setExpandedPlatform(null);
    } else {
      setExpandedPlatform(platform);
      setConnectStatus("idle");
      setConnectError(null);
      setShopDomain("");
      setWebhookUrl("");
      setImportResult(null);
      setSelectedFile(null);
    }
  };

  // ── Nango OAuth handler ───────────────────────────────────────────────────
  const handleNangoConnect = async (
    platform: "shopify" | "squarespace" | "lightspeed-retail",
  ) => {
    if (platform === "shopify" && !shopDomain.trim()) return;

    setIsConnecting(true);
    setConnectStatus("idle");
    setConnectError(null);

    // Pass `storeId` directly (it will be undefined if not provided)
    const { error } = await connectNango(
      storeId,
      platform,
      platform === "shopify" ? shopDomain.trim() : undefined,
    );

    setIsConnecting(false);
    if (error) {
      setConnectStatus("error");
      setConnectError(error);
    } else {
      setConnectStatus("success");
      await fetchIntegrations();
    }
  };

  // ── Webhook Save handler ──────────────────────────────────────────────────
  const handleWebhookSave = async () => {
    if (!webhookUrl.trim()) return;

    setIsConnecting(true);
    setConnectStatus("idle");
    setConnectError(null);

    try {
      // Pass `storeId` directly
      const { error } = await saveWebhookUrl(storeId, webhookUrl.trim());
      if (error) throw new Error(error);

      setConnectStatus("success");
      await fetchIntegrations();
    } catch (err) {
      setConnectStatus("error");
      setConnectError(
        err instanceof Error ? err.message : "Failed to save Webhook URL",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Integrations</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Platform List */}
          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {PLATFORMS.map((platform) => {
              const integration = getIntegration(platform.id);
              const isConnected = !!integration;
              const isExpanded = expandedPlatform === platform.id;

              return (
                <div
                  key={platform.id}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden border-border hover:border-primary/40 cursor-pointer ${
                    isExpanded ? "border-primary/60 shadow-sm" : ""
                  }`}
                >
                  {/* Platform Header Row */}
                  <div
                    className="flex items-center gap-4 p-4"
                    onClick={() => handleTogglePlatform(platform.id)}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${platform.logoColor}`}
                    >
                      {platform.logo}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {platform.name}
                        </span>
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs flex flex-col text-muted-foreground mt-0.5">
                        {platform.description}
                        {platform.note && (
                          <span className="text-xs text-muted-foreground mt-1">
                            {platform.note}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex-shrink-0 text-muted-foreground">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* ── Expanded: OAuth Platforms ── */}
                  {isExpanded && platform.useOAuth && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                      {platform.id === "shopify" && (
                        <div>
                          <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                            Your Shopify store URL
                          </label>
                          <input
                            type="text"
                            placeholder="mystore.myshopify.com"
                            value={shopDomain}
                            onChange={(e) => {
                              setShopDomain(e.target.value);
                              setConnectStatus("idle");
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter your store subdomain, e.g.{" "}
                            <span className="font-mono bg-muted px-1 rounded">
                              mystore.myshopify.com
                            </span>
                          </p>
                        </div>
                      )}

                      {connectStatus === "success" && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {platform.name} connected successfully!
                        </div>
                      )}
                      {connectStatus === "error" && (
                        <div className="flex items-center gap-2 text-destructive text-xs">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {connectError ||
                            "Connection failed. Please try again."}
                        </div>
                      )}

                      <button
                        onClick={() =>
                          handleNangoConnect(
                            platform.id as
                              | "shopify"
                              | "squarespace"
                              | "lightspeed-retail",
                          )
                        }
                        disabled={
                          isConnecting ||
                          (platform.id === "shopify" && !shopDomain.trim())
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        {isConnecting
                          ? "Connecting..."
                          : isConnected
                            ? `Reconnect ${platform.name}`
                            : `Connect ${platform.name}`}
                      </button>

                      <p className="text-xs text-muted-foreground">
                        A popup will open so you can log in to {platform.name}{" "}
                        and authorize access. No API keys needed.
                      </p>
                    </div>
                  )}

                  {/* ── Expanded: Webhook Platform ── */}
                  {isExpanded && platform.id === "webhook" && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                          API Key = URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://hooks.zapier.com/hooks/catch/..."
                          value={webhookUrl}
                          onChange={(e) => {
                            setWebhookUrl(e.target.value);
                            setConnectStatus("idle");
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
                        />

                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1.5">
                            We will send a POST request to this URL with the
                            following JSON payload structure:
                          </p>
                          <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto text-muted-foreground border border-border">
                            {`curl -X POST ${webhookUrl || "https://your-webhook-url.com"} \\
  -H "Content-Type: application/json" \\
  -d '{
    "firstName": "Tanmay",
    "lastName": "Jha",
    "Contact": {
      "email": "latency_test@mirourmirour.com",
      "mobile": "+919876543210"
    }
  }'`}
                          </pre>
                        </div>
                      </div>

                      {connectStatus === "success" && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs mt-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Webhook saved successfully!
                        </div>
                      )}
                      {connectStatus === "error" && (
                        <div className="flex items-center gap-2 text-destructive text-xs mt-2">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {connectError || "Failed to save webhook."}
                        </div>
                      )}

                      <button
                        onClick={handleWebhookSave}
                        disabled={isConnecting || !webhookUrl.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 mt-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        {isConnecting ? "Saving..." : "Save Webhook"}
                      </button>
                    </div>
                  )}

                  {/* ── Expanded: CSV / Excel Upload ── */}
                  {isExpanded && platform.id === "csv_xlsx" && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                          <FileSpreadsheet className="inline w-3 h-3 mr-1" />
                          Select File
                        </label>
                        <input
                          type="file"
                          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setSelectedFile(file);
                            setImportResult(null);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-input bg-background file:rounded-md file:border-0 file:bg-secondary file:text-secondary-foreground file:text-xs file:font-medium file:px-2 file:py-1 file:mr-3 hover:file:opacity-90 transition-all text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Supports .xlsx, .csv, Shopify, and Lightspeed POS
                          exports
                        </p>
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
                            Supported column names
                          </summary>
                          <div className="mt-1.5 text-xs text-muted-foreground space-y-1 pl-1">
                            <p>
                              <span className="font-mono bg-muted px-1 rounded">
                                name
                              </span>{" "}
                              /{" "}
                              <span className="font-mono bg-muted px-1 rounded">
                                Title
                              </span>{" "}
                              — product name (required)
                            </p>
                            <p>
                              <span className="font-mono bg-muted px-1 rounded">
                                sku
                              </span>{" "}
                              /{" "}
                              <span className="font-mono bg-muted px-1 rounded">
                                Variant SKU
                              </span>{" "}
                              — used for deduplication
                            </p>
                            <p>
                              <span className="font-mono bg-muted px-1 rounded">
                                retail_price
                              </span>{" "}
                              /{" "}
                              <span className="font-mono bg-muted px-1 rounded">
                                price
                              </span>{" "}
                              /{" "}
                              <span className="font-mono bg-muted px-1 rounded">
                                Variant Price
                              </span>
                            </p>
                            <p>
                              <span className="font-mono bg-muted px-1 rounded">
                                description
                              </span>{" "}
                              /{" "}
                              <span className="font-mono bg-muted px-1 rounded">
                                Body (HTML)
                              </span>
                            </p>
                            <p>
                              <span className="font-mono bg-muted px-1 rounded">
                                image_url
                              </span>{" "}
                              /{" "}
                              <span className="font-mono bg-muted px-1 rounded">
                                Image Src
                              </span>{" "}
                              — first URL used if multiple
                            </p>
                            <p>
                              <span className="font-mono bg-muted px-1 rounded">
                                tags
                              </span>{" "}
                              — comma-separated, auto-created
                            </p>
                          </div>
                        </details>
                      </div>

                      {/* Image index picker */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-muted-foreground">
                          Which image to import
                        </label>
                        <div className="flex gap-2">
                          {["1st", "2nd", "3rd"].map((label, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setImageIndex(i)}
                              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                                imageIndex === i
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          For exports with multiple images per product (e.g.
                          Lightspeed POS)
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (!selectedFile) return;
                            setIsImporting(true);
                            setImportResult(null);

                            try {
                              let parsedData: any[] = [];

                              if (selectedFile.name.endsWith(".csv")) {
                                const text = await selectedFile.text();
                                await new Promise<void>((resolve, reject) => {
                                  Papa.parse(text, {
                                    header: true,
                                    skipEmptyLines: true,
                                    complete: async (results) => {
                                      try {
                                        const result =
                                          await importProductsFromFile(
                                            results.data,
                                            storeId,
                                            imageIndex,
                                          );
                                        setImportResult(result);
                                        resolve();
                                      } catch (err) {
                                        const errorMessage =
                                          err instanceof Error
                                            ? err.message
                                            : "Import failed.";
                                        setImportResult({
                                          imported: 0,
                                          skipped: 0,
                                          error: errorMessage,
                                        });
                                        reject(err);
                                      }
                                    },
                                    error: (err: any) => {
                                      setImportResult({
                                        imported: 0,
                                        skipped: 0,
                                        error:
                                          err.message || "Failed to parse CSV.",
                                      });
                                      reject(err);
                                    },
                                  });
                                });
                              } else {
                                const arrayBuffer =
                                  await selectedFile.arrayBuffer();
                                const data = new Uint8Array(arrayBuffer);
                                const workbook = XLSX.read(data, {
                                  type: "array",
                                });
                                const firstSheet = workbook.SheetNames[0];
                                const worksheet = workbook.Sheets[firstSheet];
                                parsedData = XLSX.utils.sheet_to_json(
                                  worksheet,
                                  { defval: "" },
                                );

                                const result = await importProductsFromFile(
                                  parsedData,
                                  storeId,
                                  imageIndex,
                                );
                                setImportResult(result);
                              }
                            } catch (err) {
                              const errorMessage =
                                err instanceof Error
                                  ? err.message
                                  : "Failed to read file.";
                              setImportResult({
                                imported: 0,
                                skipped: 0,
                                error: errorMessage,
                              });
                            } finally {
                              setIsImporting(false);
                              setSelectedFile(null);
                            }
                          }}
                          disabled={isImporting || !selectedFile}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isImporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          {isImporting ? "Importing..." : "Process Upload"}
                        </button>
                      </div>

                      {/* Import Result */}
                      {importResult && (
                        <div
                          className={`rounded-lg p-3 text-xs ${
                            importResult.error
                              ? "bg-destructive/10 text-destructive border border-destructive/20"
                              : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                          }`}
                        >
                          {importResult.error ? (
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              <span>Import failed: {importResult.error}</span>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium">
                                  {importResult.imported} product
                                  {importResult.imported !== 1 ? "s" : ""}{" "}
                                  imported
                                </span>
                                {importResult.skipped > 0 && (
                                  <span className="text-muted-foreground ml-1">
                                    ({importResult.skipped} skipped — already
                                    exist)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              More integrations coming soon. Contact us to request a specific
              platform.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
