// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Search,
  AlertCircle,
  Tag,
  Eye,
  EyeOff,
  ChevronRight,
  Clock,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import { formatInStoreTime } from "@/lib/utils";
import { trackEvent } from "@/lib/mixpanel";

type Customer = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  traits: {
    tags?: string[];
    [key: string]: any;
  };
  visit_count: number;
  last_active?: string;
  created_at: string;
  zones_saved?: string[];
  skus_shown_all?: string[];
  // Hydrated
  tagNames?: string[];
};

type RespondersProps = {
  onNavigateToUserProfile?: (id: string) => void;
};

export function Responders({ onNavigateToUserProfile }: RespondersProps) {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<Record<string, string>>({}); // id -> name
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [revealedPhones, setRevealedPhones] = useState<Set<string>>(new Set());
  const [noStore, setNoStore] = useState(false);

  const maskPhone = (phone: string) => {
    if (!phone) return "-";
    if (phone.startsWith("+1") && phone.length === 12) {
      return `+1 ${phone.substring(2, 5)} ••• ••••`;
    }
    return phone.substring(0, 5) + " ••••••";
  };

const loadData = async () => {
  setLoading(true);
  setNoStore(false);
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    console.log("user", user);

    // Step 1: Get all forms owned by this user
    const { data: forms } = await supabase
      .from("forms")
      .select("id")
      .eq("owner_id", user.id);

      console.log("forms", forms);

    if (!forms || forms.length === 0) {
      setCustomers([]);
      return;
    }

    const formIds = forms.map((f) => f.id);

    // Step 2: Get all responses to those forms that have a customer linked
    const { data: responses } = await supabase
      .from("responses")
      .select("customer_id")
      .in("form_id", formIds)
      .not("customer_id", "is", null);

    if (!responses || responses.length === 0) {
      setCustomers([]);
      return;
    }

    // Step 3: Unique customer IDs only
    const customerIds = [...new Set(responses.map((r) => r.customer_id))];

    // Step 4: Fetch those customer records
    const { data: rows } = await supabase
      .from("customers")
      .select("*")
      .in("id", customerIds)
      .order("last_active", { ascending: false, nullsFirst: false });

    setCustomers(rows || []);
  } catch (err) {
    console.error("loadData failed:", err);
  } finally {
    setLoading(false);
  }
};



  useEffect(() => {
    loadData();
  }, []);

  const filtered = customers.filter((c) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-foreground text-2xl">Customers</h2>
            <p className="text-muted-foreground text-sm">
              {customers.length} total customers with saved profiles
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="bg-card rounded-3xl shadow-xl shadow-primary/10 border-2 border-primary/10 overflow-hidden">
        <div className="p-6">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted rounded-xl border border-border focus:outline-none focus:border-primary text-sm"
            />
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Loading customers...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-foreground mb-2">No customers found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm
                  ? "Try a different search term"
                  : "Customers appear here once they complete a quiz"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                      Customer
                    </th>
                    <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                      Phone
                    </th>
                    <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                      Visits
                    </th>
                    <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                      Last Active
                    </th>
                    <th className="px-5 py-3 text-left text-muted-foreground font-medium">
                      Status
                    </th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => {
                        trackEvent("Customer Profile Clicked", {
                          customerId: customer.id,
                          hasEmail: !!customer.email,
                          hasPhone: !!customer.phone,
                          visitCount: customer.visit_count,
                        });
                        onNavigateToUserProfile?.(customer.id);
                      }}
                    >
                      {/* Name + Email */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-foreground">
                          {customer.name ||
                            customer.phone ||
                            customer.email ||
                            "Anonymous"}
                        </p>
                        {customer.email && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {customer.email}
                          </p>
                        )}
                      </td>

                      {/* Phone (masked) */}
                      <td className="px-5 py-4">
                        {!customer.phone ? (
                          <span className="text-muted-foreground">–</span>
                        ) : revealedPhones.has(customer.id) ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevealedPhones((prev) => {
                                const n = new Set(prev);
                                n.delete(customer.id);
                                return n;
                              });
                            }}
                            className="font-mono text-foreground flex items-center gap-1.5 hover:text-primary transition-colors"
                          >
                            {customer.phone}
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevealedPhones((prev) =>
                                new Set(prev).add(customer.id),
                              );
                            }}
                            className="font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {maskPhone(customer.phone)}
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>

                      {/* Tags */}
                      {/* Removed tags column */}

                      {/* Visit Count */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="tabular-nums text-foreground">
                            {customer.visit_count ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="px-5 py-4">
                        {customer.last_active ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            {formatInStoreTime(new Date(customer.last_active))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Never
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-4">
                        {(customer.visit_count ?? 0) >= 4 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-medium">
                            VIP
                          </span>
                        ) : (customer.visit_count ?? 0) >= 2 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-foreground text-background text-xs font-medium">
                            Repeat
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">
                            New
                          </span>
                        )}
                      </td>

                      {/* Arrow */}
                      <td className="px-4 py-4 text-right">
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
