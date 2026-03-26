"use client";

import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  ShoppingBag,
  Edit2,
  Check,
  X,
  Tag,
  RefreshCw,
  Timer,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatInStoreTime } from "@/lib/utils";
import { trackEvent } from "@/lib/mixpanel";
import { CustomerFormSubmissions } from "./CustomerFormSubmissions";

type ResponderProfileProps = {
  userId: string;
  // forms: DashboardForm[]; <-- REMOVED: No longer needed!
  onBack: () => void;
  onNavigateToResponse: (formId: string, searchQuery: string) => void;
  onUpdateCustomerInfo: (
    responseId: string,
    updates: {
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
    },
  ) => Promise<{ error: Error | null }>;
};

export function ResponderProfile({
  userId,
  onBack,
  onNavigateToResponse,
  onUpdateCustomerInfo,
}: ResponderProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [customerRecord, setCustomerRecord] = useState<any>(null);
  const [savedProducts, setSavedProducts] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [flowSessions, setFlowSessions] = useState<any[]>([]);

  // Submissions loaded asynchronously by CustomerFormSubmissions
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    const fetchCustomer = async () => {
      const isUUID = /^[0-9a-f-]{36}$/i.test(userId);
      let query: any = supabase
        .from("customers")
        .select("*")
        .limit(1);

      if (isUUID) {
        query = query.eq("id", userId);
      } else if (userId.startsWith("+") || /^\+?\d{7,}$/.test(userId)) {
        query = query.eq("phone", userId);
      } else {
        query = query.eq("email", userId);
      }

      const { data } = await query.maybeSingle();

      if (data) {
        setCustomerRecord(data);

        const { data: store } = (await supabase
          .from("stores")
          .select("id")
          .eq("owner_id", (await supabase.auth.getUser()).data.user?.id || "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()) as any;

        if (store) {
          const { data: savedItemsData } = (await supabase
            .from("saved_items")
            .select(`product_id, products (id, name, price, image_url)`)
            .eq("customer_id", data.id)
            .eq("store_id", store.id)) as any;

          if (savedItemsData) {
            const products = savedItemsData
              .map((item: any) => item.products)
              .filter(Boolean);
            setSavedProducts(products);
          }

          const { data: interactionsData } = (await supabase
            .from("interactions")
            .select("*")
            .eq("customer_id", data.id)
            .eq("store_id", store.id)
            .order("created_at", { ascending: false })) as any;

          if (interactionsData) setInteractions(interactionsData);

          const { data: sessionsData } = (await supabase
            .from("flow_sessions")
            .select(
              "id, form_id, customer_id, response_id, status, flow_version, visited_nodes, drop_off_node_id, total_time_seconds, started_at, completed_at, last_activity_at",
            )
            .eq("customer_id", data.id)
            .order("started_at", { ascending: false })
            .limit(50)) as any;

          if (sessionsData) setFlowSessions(sessionsData);

          // REMOVED: storeProducts, storeZones, locationJourneys (unused in UI)
        }
      }
    };
    fetchCustomer();
  }, [userId]);

  // ── Calculate Display Names safely ──
  let userName = "";
  let userEmail = "";
  let userPhone = "";
  let firstResponseId =
    userSubmissions.length > 0 ? userSubmissions[0].responseId : "";

  if (userSubmissions.length > 0) {
    const latest = userSubmissions[0];
    userName = latest.customerName || "";
    userEmail = latest.customerEmail || "";
    userPhone = latest.customerPhone || "";
  }

  if (customerRecord) {
    if (!userName && customerRecord.name) userName = customerRecord.name;
    if (!userEmail && customerRecord.email) userEmail = customerRecord.email;
    if (!userPhone && customerRecord.phone) userPhone = customerRecord.phone;
  }

  const totalSubmissions = userSubmissions.length;
  let status = "New";
  let statusClasses = "bg-amber-500";

  if (totalSubmissions >= 5) {
    status = "VIP";
    statusClasses = "bg-gradient-to-r from-primary to-primary/70";
  } else if (totalSubmissions >= 3) {
    status = "Regular";
    statusClasses = "bg-secondary text-secondary-foreground";
  }

  const handleEdit = () => {
    setEditValues({ name: userName, email: userEmail, phone: userPhone });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!firstResponseId) return;
    setIsSaving(true);

    const updatePromises = userSubmissions.map((submission) =>
      onUpdateCustomerInfo(submission.responseId, {
        customer_name: editValues.name || undefined,
        customer_email: editValues.email || undefined,
        customer_phone: editValues.phone || undefined,
      }),
    );

    await Promise.all(updatePromises);

    trackEvent("Customer Profile Updated", {
      customerId: userId,
      submissionsCount: userSubmissions.length,
    });

    setIsSaving(false);
    setIsEditing(false);
    toast({
      title: "Profile Updated",
      description: "Customer information has been successfully saved.",
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const qrScans = interactions.filter((i) => i.event_type === "qr_scan");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-lg"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Customers
      </button>

      {/* Profile Header */}
      <div className="bg-card rounded-3xl shadow-xl border border-border p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center border border-primary/20 overflow-hidden shadow-sm">
              <img
                src={`https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(userName || userEmail || userPhone || userId)}`}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                {userName || userPhone || userEmail || "Anonymous User"}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-full ${statusClasses} text-white text-sm font-medium`}
                >
                  {status}
                </span>
                {customerRecord?.tags?.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-foreground text-background rounded-xl hover:opacity-90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-muted rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Name</p>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editValues.name}
                onChange={(e) =>
                  setEditValues({ ...editValues, name: e.target.value })
                }
                className="w-full px-3 py-2 bg-card border-2 border-primary rounded-xl focus:outline-none text-foreground"
                placeholder="Enter name"
              />
            ) : (
              <p className="text-foreground">{userName || "Not provided"}</p>
            )}
          </div>

          <div className="bg-muted rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Email</p>
            </div>
            {isEditing ? (
              <input
                type="email"
                value={editValues.email}
                onChange={(e) =>
                  setEditValues({ ...editValues, email: e.target.value })
                }
                className="w-full px-3 py-2 bg-card border-2 border-primary rounded-xl focus:outline-none text-foreground"
                placeholder="Enter email"
              />
            ) : (
              <p className="text-foreground">{userEmail || "Not provided"}</p>
            )}
          </div>

          <div className="bg-muted rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Phone</p>
            </div>
            {isEditing ? (
              <input
                type="tel"
                value={editValues.phone}
                onChange={(e) =>
                  setEditValues({ ...editValues, phone: e.target.value })
                }
                className="w-full px-3 py-2 bg-card border-2 border-primary rounded-xl focus:outline-none text-foreground"
                placeholder="Enter phone"
              />
            ) : (
              <p className="text-foreground">{userPhone || "Not provided"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl shadow-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-primary" />
              <p className="text-sm text-muted-foreground">Submissions</p>
            </div>
            <p className="text-3xl font-semibold text-primary">
              {totalSubmissions}
            </p>
          </div>
          <div className="bg-card rounded-2xl shadow-lg border border-border p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-blue-500" />
              <p className="text-sm text-muted-foreground">Visitor Status</p>
            </div>
            <p className="text-xl font-semibold text-blue-500">
              {customerRecord?.visit_count > 1 || flowSessions.length > 1
                ? "Returning Visitor"
                : "New Visitor"}
            </p>
          </div>
          <div className="bg-card rounded-2xl shadow-lg border border-border p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-5 h-5 text-purple-500" />
              <p className="text-sm text-muted-foreground">Flow Sessions</p>
            </div>
            <p className="text-xl font-semibold text-purple-500">
              {flowSessions.length}
            </p>
          </div>

          {customerRecord && (
            <div className="bg-card rounded-2xl shadow-lg border border-border p-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                <p className="text-sm text-muted-foreground">Customer Since</p>
              </div>
              <p className="text-sm font-medium text-foreground">
                {customerRecord.created_at
                  ? formatInStoreTime(new Date(customerRecord.created_at))
                  : "—"}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-4"></div>
      </div>

      {/* Saved Items */}
      {savedProducts.length > 0 && (
        <div className="bg-card rounded-3xl shadow-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Saved Items
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {savedProducts.map((product: any, i: number) => (
              <div
                key={i}
                className="bg-muted rounded-xl border border-border p-3 flex flex-col"
              >
                <div className="w-full h-96 bg-background rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl opacity-20">📦</span>
                  )}
                </div>
                <h4 className="text-foreground text-sm font-medium leading-tight mb-1">
                  {product.name}
                </h4>
                {product.price && (
                  <p className="text-muted-foreground text-xs font-mono">
                    ${product.price}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Submissions List */}
      <CustomerFormSubmissions
        userId={userId}
        customerRecord={customerRecord}
        flowSessions={flowSessions}
        onSubmissionsLoaded={setUserSubmissions}
      />
    </div>
  );
}
