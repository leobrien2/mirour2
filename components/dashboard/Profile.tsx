"use client";

import { useState, useEffect } from "react";
import { Building2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { trackEvent } from "@/lib/mixpanel";

type ProfileProps = {
  businessName: string;
  businessLogo: string | null;
  onUpdateProfile: (name: string, logo: string | null) => Promise<void>;
};

export function Profile({
  businessName,
  businessLogo,
  onUpdateProfile,
}: ProfileProps) {
  const [name, setName] = useState(businessName);
  const [logo, setLogo] = useState<string | null>(businessLogo);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const PRESET_LOGOS = [
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour1",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour2",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour3",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour4",
    "https://api.dicebear.com/9.x/glass/svg?seed=Mirour5",
  ];

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    try {
      // Upload to Supabase storage in user's folder
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("logos").getPublicUrl(fileName);

      setLogo(publicUrl);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
  };

  const handleSave = async () => {
    await onUpdateProfile(name, logo);
    trackEvent("Admin Profile Updated", { hasName: !!name, hasLogo: !!logo });
    toast({
      title: "Success",
      description: "Profile updated successfully!",
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card rounded-3xl shadow-2xl shadow-primary/10 border-2 border-primary/10 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-8 border-b border-primary/10">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-6 h-6 text-primary" />
            <h2 className="font-heading text-foreground">Business Profile</h2>
          </div>
          <p className="text-muted-foreground">
            Manage your business information
          </p>
        </div>

        <div className="p-8 space-y-8">
          {/* Business Name */}
          <div>
            <label className="block text-foreground mb-2">Business Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary transition-all bg-card"
              placeholder="Your business name"
            />
          </div>

          {/* Business Logo */}
          <div>
            <label className="block text-foreground mb-2">Business Logo</label>
            <p className="text-sm text-muted-foreground mb-3">
              Upload a 1:1 square, high-resolution image for best display on
              customer forms
            </p>
            <div className="relative">
              {logo ? (
                <div className="relative w-48 h-48 bg-secondary rounded-full border-2 border-primary/20 overflow-hidden mx-auto">
                  <img
                    src={logo}
                    alt="Business Logo"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute top-2 right-2 w-8 h-8 bg-destructive hover:opacity-90 text-destructive-foreground rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block w-48 h-48 bg-secondary rounded-full border-2 border-dashed border-primary/30 hover:border-primary cursor-pointer transition-all mx-auto overflow-hidden">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                    <Upload className="w-10 h-10 text-primary" />
                    <span className="text-muted-foreground text-center px-2">
                      {uploading ? "Uploading..." : "1:1 Square Logo"}
                    </span>
                  </div>
                </label>
              )}
            </div>

            <div className="mt-8 text-center px-4">
              <p className="text-sm font-medium text-foreground mb-4">
                Or choose a preset avatar
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                {PRESET_LOGOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLogo(preset)}
                    className="w-16 h-16 rounded-full border-4 border-transparent hover:border-primary focus:border-primary hover:scale-105 transition-all overflow-hidden shadow-md bg-secondary"
                  >
                    <img
                      src={preset}
                      alt={`preset-${idx}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Connections Section */}
          <div>
            <label className="block text-foreground font-medium mb-4">
              Connections
            </label>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
                <div>
                  <p className="font-medium text-foreground">POS System</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your point of sale
                  </p>
                </div>
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
                <div>
                  <p className="font-medium text-foreground">CRM</p>
                  <p className="text-sm text-muted-foreground">
                    Sync customer data
                  </p>
                </div>
                <Switch disabled />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
                <div>
                  <p className="font-medium text-foreground">Social</p>
                  <p className="text-sm text-muted-foreground">
                    Link social accounts
                  </p>
                </div>
                <Switch disabled />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full py-4 px-6 bg-foreground text-background rounded-2xl hover:opacity-90 hover:shadow-xl hover:shadow-foreground/30 transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
