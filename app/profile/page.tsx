"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import {
  User,
  Store,
  Shield,
  Briefcase,
  Camera,
  Upload,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ProfileContent />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { user, profile, updateProfile } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState(
    profile?.business_name || "",
  );
  const [businessLogo, setBusinessLogo] = useState(
    profile?.business_logo || "",
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Sync state when profile loads
  // We use `profile` as a dependency because it might be null on mount and populate later
  useEffect(() => {
    if (profile && !isEditing) {
      setBusinessName(profile.business_name || "");
      setBusinessLogo(profile.business_logo || "");
    }
  }, [profile, isEditing]);

  const PRESET_LOGOS = [
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour1",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour2",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour3",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour4",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour5",
  ];

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadLogo = async (userId: string): Promise<string | null> => {
    if (!logoFile) return null;
    try {
      const fileExt = logoFile.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Logo upload failed:", error);
      return null;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let finalLogoUrl = businessLogo;

    // Upload file if selected
    if (logoFile && user) {
      const uploadedUrl = await uploadLogo(user.id);
      if (uploadedUrl) finalLogoUrl = uploadedUrl;
    }

    const { error } = await updateProfile({
      business_name: businessName,
      business_logo: finalLogoUrl,
    });

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      setIsEditing(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground">
          Profile Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and business information.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 space-y-8">
          {/* Account Details Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Account Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/50 p-4 rounded-lg">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">
                  Email Address
                </label>
                <div className="text-foreground">{user?.email}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">
                  Role
                </label>
                <div className="flex items-center gap-2 text-foreground capitalize">
                  {profile.role === "owner" ? (
                    <Shield className="w-4 h-4 text-mirour-accent" />
                  ) : (
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                  )}
                  {profile.role || "User"}
                </div>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Business Information Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                Business Information
              </h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground">
                  Business Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground transition-all"
                  />
                ) : (
                  <div className="text-foreground text-lg py-1 px-4 bg-muted/30 rounded-lg inline-block border border-transparent">
                    {profile.business_name || "Not set"}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-foreground flex justify-between">
                  <span>Business Logo</span>
                  <span className="text-muted-foreground font-normal text-xs">
                    Optional
                  </span>
                </label>
                <div className="space-y-6">
                  {/* Active Upload/Preview Edit block */}
                  <div className="flex flex-col gap-4 p-4 border rounded-xl bg-card">
                    <p className="font-medium text-sm">
                      Upload and update profile pic
                    </p>
                    <div className="flex flex-wrap items-center gap-6">
                      {logoPreview || businessLogo ? (
                        <div className="relative w-24 h-24 bg-card rounded-full border-2 border-primary overflow-hidden shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={logoPreview || businessLogo || ""}
                            alt="Logo preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setLogoFile(null);
                              setLogoPreview(null);
                              setBusinessLogo(""); // clear existing URL if they cancel
                              // Force edit mode open so they can save this change
                              setIsEditing(true);
                            }}
                            className="absolute top-1 right-1 w-6 h-6 bg-destructive hover:opacity-90 text-destructive-foreground rounded-full flex items-center justify-center transition-colors shadow-md z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-muted/50 rounded-full border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground text-xs gap-1">
                          <Camera className="w-4 h-4" />
                          No logo
                        </div>
                      )}

                      <div className="flex-1 space-y-4">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 cursor-pointer transition-colors shadow-sm">
                          <Upload className="w-4 h-4" />
                          Upload new image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              handleLogoSelect(e);
                              setIsEditing(true); // force editing mode open
                            }}
                            className="hidden"
                          />
                        </label>

                        
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
              <button
                onClick={() => {
                  setBusinessName(profile.business_name || "");
                  setBusinessLogo(profile.business_logo || "");
                  setLogoFile(null);
                  setLogoPreview(null);
                  setIsEditing(false);
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-transparent"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !businessName.trim()}
                className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
