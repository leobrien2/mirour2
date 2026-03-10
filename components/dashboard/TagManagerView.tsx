"use client";

import { useState, useMemo } from "react";
import { useStores } from "@/hooks/useStores";
import { Tag } from "@/types/mirour";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tag as TagIcon,
  Plus,
  Edit2,
  Trash2,
  Search,
  TagsIcon,
  ArrowLeft,
} from "lucide-react";
import { trackEvent } from "@/lib/mixpanel";
import { useRouter } from "next/navigation";

export function TagManagerView() {
  const router = useRouter();
  const { stores, tags, createTag, updateTag, deleteTag, products, zones } =
    useStores();

  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create/Edit Dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagCategory, setTagCategory] = useState("");
  const [createStoreId, setCreateStoreId] = useState("");

  // Delete Dialog
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // Filter tags based on selections
  const filteredTags = useMemo(() => {
    let filtered = tags;

    // Filter by store
    if (selectedStoreId !== "all") {
      filtered = filtered.filter((t) => t.store_id === selectedStoreId);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          (t.category && t.category.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [tags, selectedStoreId, searchQuery]);

  // Get usage stats for a tag
  const getTagUsage = (tagId: string) => {
    const productCount = products.filter((p) =>
      p.tags?.some((t) => t.id === tagId),
    ).length;

    // Note: zones don't have tags hydrated in current implementation
    // Would need to check zone_tags junction table
    return { productCount, zoneCount: 0 };
  };

  const handleOpenCreate = () => {
    setEditingTag(null);
    setTagName("");
    setTagCategory("");
    setCreateStoreId("");
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagCategory(tag.category || "");
    setIsCreateOpen(true);
  };

  const handleSave = async () => {
    if (!tagName.trim()) return;

    setIsLoading(true);
    try {
      if (editingTag) {
        // Update existing tag
        await updateTag(editingTag.id, {
          name: tagName.trim(),
          category: tagCategory.trim() || undefined,
          is_hard_constraint: false,
        });
        trackEvent("Tag Updated", {
          tagId: editingTag.id,
          tagName: tagName.trim(),
        });
      } else {
        // Create new tag (store is optional)
        await createTag(
          createStoreId || "",
          tagName.trim(),
          tagCategory.trim(),
          false,
        );
        trackEvent("Tag Created", {
          tagName: tagName.trim(),
          storeId: createStoreId || null,
        });
      }
      setIsCreateOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) return;

    setIsLoading(true);
    try {
      await deleteTag(deletingTag.id);
      trackEvent("Tag Deleted", {
        tagId: deletingTag.id,
        tagName: deletingTag.name,
      });
      setDeletingTag(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getStoreName = (storeId: string) => {
    return stores.find((s) => s.id === storeId)?.name || "N/A";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <TagsIcon className="h-5 w-5 text-primary" /> Tags
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage tags across all your stores to help customers find
              products.
            </p>
          </div>
        </div>

        {/* Create Button moved to header-level for prominence */}
        <Button onClick={handleOpenCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Create Tag
        </Button>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search — takes up remaining space */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Store Filter — fixed width, right-aligned */}
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tags Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            {filteredTags.length} tag{filteredTags.length !== 1 ? "s" : ""}{" "}
            found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTags.length === 0 ? (
            <div className="text-center py-12">
              <TagIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tags found</p>
              <Button onClick={handleOpenCreate} className="mt-4">
                Create your first tag
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Category
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-left py-3 px-4 font-medium">Usage</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.map((tag) => {
                    const usage = getTagUsage(tag.id);
                    return (
                      <tr key={tag.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{tag.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {tag.category || "-"}
                        </td>

                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {getStoreName(tag.store_id)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {usage.productCount} product
                          {usage.productCount !== 1 ? "s" : ""}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(tag)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingTag(tag)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Edit Tag" : "Create Tag"}</DialogTitle>
            <DialogDescription>
              {editingTag
                ? "Update the tag details below."
                : "Create a new tag for your products and zones."}
            </DialogDescription>
          </DialogHeader>
          <div className=" space-y-4">
            <div className="flex flex-col space-y-3">
              <Label htmlFor="tag-name">Tag Name *</Label>
              <Input
                id="tag-name"
                placeholder="e.g., No-sugar, Social, Calm"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
              />
            </div>
            {!editingTag && (
              <div className=" flex flex-col space-y-2">
                <Label>Location (optional)</Label>
                <Select value={createStoreId} onValueChange={setCreateStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col space-y-2">
              <Label htmlFor="tag-category">Category (optional)</Label>
              <Input
                id="tag-category"
                placeholder="e.g., Dietary, Mood, Effect"
                value={tagCategory}
                onChange={(e) => setTagCategory(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!tagName.trim() || isLoading}
            >
              {editingTag ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingTag?.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTag(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
