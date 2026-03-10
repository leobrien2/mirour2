"use client";

import { useState, useEffect } from "react";
import { useStores } from "@/hooks/useStores";
import { Zone, Tag } from "@/types/mirour";
import { Plus, Pencil, Trash2, Map, QrCode, X, Loader2 } from "lucide-react";
import { QRCodeDisplay } from "../QRCodeDisplay";
import { Badge } from "@/components/ui/badge";
import { DashboardForm } from "@/types/dashboard";

interface ZoneManagerProps {
  storeId: string;
  forms: DashboardForm[];
}

export function ZoneManager({ storeId, forms }: ZoneManagerProps) {
  const {
    zones,
    tags,
    createZone,
    updateZone,
    deleteZone,
    linkTagToZone,
    unlinkTagFromZone,
    isLoading,
  } = useStores();
  const storeZones = zones.filter((z) => z.store_id === storeId);
  const storeTags = tags.filter((t) => t.store_id === storeId);

  const [isCreating, setIsCreating] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [viewingQR, setViewingQR] = useState<Zone | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [zoneWhat, setZoneWhat] = useState("");
  const [zoneWhen, setZoneWhen] = useState("");
  const [zoneWho, setZoneWho] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const MAX_TAGS_PER_ZONE = 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingZone) {
      // Update zone
      await updateZone(editingZone.id, {
        name,
        description,
        zone_what: zoneWhat,
        zone_when: zoneWhen,
        zone_who: zoneWho,
      });

      // Get current zone tags
      const currentTags = (editingZone as any).tags || [];
      const currentTagIds = currentTags.map((t: Tag) => t.id);

      // Find tags to add and remove
      const tagsToAdd = selectedTagIds.filter(
        (id) => !currentTagIds.includes(id),
      );
      const tagsToRemove = currentTagIds.filter(
        (id: string) => !selectedTagIds.includes(id),
      );

      // Link new tags
      for (const tagId of tagsToAdd) {
        await linkTagToZone(editingZone.id, tagId);
      }

      // Unlink removed tags
      for (const tagId of tagsToRemove) {
        await unlinkTagFromZone(editingZone.id, tagId);
      }

      setEditingZone(null);
    } else {
      // Create zone
      const result = await createZone(
        storeId,
        name,
        description,
        zoneWhat,
        zoneWhen,
        zoneWho,
      );
      if (result.data && selectedTagIds.length > 0) {
        // Link tags to new zone
        for (const tagId of selectedTagIds) {
          await linkTagToZone(result.data.id, tagId);
        }
      }
      setIsCreating(false);
    }

    // Reset form
    setName("");
    setDescription("");
    setZoneWhat("");
    setZoneWhen("");
    setZoneWho("");
    setSelectedTagIds([]);
  };

  const startEdit = (zone: Zone) => {
    setEditingZone(zone);
    setName(zone.name);
    setDescription(zone.description || "");
    setZoneWhat(zone.zone_what || "");
    setZoneWhen(zone.zone_when || "");
    setZoneWho(zone.zone_who || "");

    // Pre-select existing tags
    const zoneTags = (zone as any).tags || [];
    setSelectedTagIds(zoneTags.map((t: Tag) => t.id));
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      } else {
        if (prev.length >= MAX_TAGS_PER_ZONE) {
          alert(`Maximum ${MAX_TAGS_PER_ZONE} tags allowed per zone`);
          return prev;
        }
        return [...prev, tagId];
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Zones ({storeZones.length})</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Zone
        </button>
      </div>

      {(isCreating || editingZone) && (
        <div className="bg-muted/30 p-4 rounded-xl border border-border animate-fade-in">
          <h4 className="font-medium mb-3">
            {editingZone ? "Edit Zone" : "New Zone"}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="Zone Name (e.g. Social Sippers)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                required
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Description (Optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background"
              />
            </div>

            {/* Education Copy Fields */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-sm font-medium text-muted-foreground">
                Education Copy (for zone flows)
              </label>
              <input
                type="text"
                placeholder="What: Non-alcoholic cocktails and craft sodas"
                value={zoneWhat}
                onChange={(e) => setZoneWhat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
              <input
                type="text"
                placeholder="When: Parties, dinners, social gatherings"
                value={zoneWhen}
                onChange={(e) => setZoneWhen(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
              <input
                type="text"
                placeholder="Who: Social butterflies looking for celebration"
                value={zoneWho}
                onChange={(e) => setZoneWho(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
            </div>

            {/* Tag Multi-Select */}
            {storeTags.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Tags (max {MAX_TAGS_PER_ZONE})
                </label>
                <div className="flex flex-wrap gap-2">
                  {storeTags.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary border-2 border-primary"
                            : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                        }`}
                      >
                        {tag.name}
                        {isSelected && (
                          <X className="inline-block w-3 h-3 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingZone(null);
                  setName("");
                  setDescription("");
                  setSelectedTagIds([]);
                }}
                className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground w-full">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
          <p>Loading zones...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {storeZones.map((zone) => {
            const zoneTags = (zone as any).tags || [];
            return (
              <div
                key={zone.id}
                className="bg-card rounded-xl border border-border overflow-hidden group hover:shadow-lg transition-all duration-200 flex flex-col h-[190px]"
              >
                {/* Zone Header with Icon */}
                <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-4 border-b border-border h-26">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary shrink-0">
                        <Map className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          className="font-semibold text-base truncate"
                          title={zone.name}
                        >
                          {zone.name}
                        </h4>
                        {zone.description && (
                          <p
                            className="text-sm text-muted-foreground line-clamp-2"
                            title={zone.description}
                          >
                            {zone.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - Show on hover */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() =>
                        setViewingQR(viewingQR?.id === zone.id ? null : zone)
                      }
                      className={`p-1.5 rounded-lg transition-colors shadow-md ${viewingQR?.id === zone.id ? "bg-primary text-primary-foreground" : "bg-background/90 hover:bg-background text-foreground"}`}
                      title="View QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEdit(zone)}
                      className="p-1.5 bg-background/90 hover:bg-background rounded-lg text-foreground shadow-md"
                      title="Edit Zone"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this zone?")) deleteZone(zone.id);
                      }}
                      className="p-1.5 bg-background/90 hover:bg-destructive/90 rounded-lg text-foreground hover:text-destructive-foreground shadow-md"
                      title="Delete Zone"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Zone Info - Tags Section */}
                <div className="flex-1 p-4 flex flex-col overflow-hidden">
                  {/* Color-coded Tag Chips - Show first 2 + count, all on hover */}
                  {zoneTags.length > 0 && (
                    <div className="relative group/tags">
                      <div className="flex flex-wrap gap-1">
                        {zoneTags.slice(0, 10).map((tag: Tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-xs px-2 py-0.5 truncate"
                          >
                            {tag.name}
                          </Badge>
                        ))}
                        {zoneTags.length > 10 && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0.5"
                          >
                            +{zoneTags.length - 10}
                          </Badge>
                        )}
                      </div>

                      {/* Hover Tooltip - Show all tags */}
                      {zoneTags.length > 10 && (
                        <div className="absolute bottom-full left-0 mb-2 p-2 bg-popover text-popover-foreground rounded-lg shadow-lg border border-border opacity-0 invisible group-hover/tags:opacity-100 group-hover/tags:visible transition-all duration-200 z-10 min-w-[200px] max-w-[280px]">
                          <div className="text-xs font-medium mb-1">
                            All Tags:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {zoneTags.map((tag: Tag) => (
                              <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-xs px-2 py-0.5"
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {zoneTags.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">
                      No tags assigned
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {storeZones.length === 0 && !isCreating && (
            <div className="text-center col-span-full py-8 text-muted-foreground text-sm border-2 border-dashed border-muted rounded-xl">
              No zones yet. Create zones (e.g. "Seltzers", "Wines") to organize
              your location.
            </div>
          )}
        </div>
      )}

      {/* QR Code Display for Zone */}
      {viewingQR && (
        <div className="mt-4 p-4 border rounded-xl bg-muted/20 animate-fade-in relative">
          <button
            onClick={() => setViewingQR(null)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>

          <h4 className="font-medium mb-4 text-center">
            Zone QR Code: {viewingQR.name}
          </h4>

          <div className="space-y-4">
            {forms.length > 0 ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Link to Flow
                  </label>
                  <select
                    className="w-full p-2 rounded-md border bg-background"
                    value={selectedFlowId || forms[0].id}
                    onChange={(e) => setSelectedFlowId(e.target.value)}
                  >
                    {forms
                      .filter((f) => f.active)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select which flow users should see when scanning this code.
                  </p>
                </div>

                <div className="flex justify-center bg-white p-4 rounded-xl">
                  <QRCodeDisplay
                    value={selectedFlowId || forms[0].id}
                    zoneId={viewingQR.id}
                    businessName={viewingQR.name}
                    size={200}
                    formData={forms.find(
                      (f) => f.id === (selectedFlowId || forms[0].id),
                    )}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  scans as:{" "}
                  <span className="font-mono">?zone_id={viewingQR.id}</span>
                </p>
              </>
            ) : (
              <div className="text-center text-muted-foreground text-sm">
                Create a flow first to generate a QR code.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
