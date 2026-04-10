"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStores } from "@/hooks/useStores";
import { useAuth } from "@/hooks/useAuth";
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
  Loader2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Box,
  AlertTriangle,
} from "lucide-react";
import { trackEvent } from "@/lib/mixpanel";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";

const TAGS_PAGE_SIZE = 15;

export function TagManagerView() {
  const router = useRouter();
  const { user } = useAuth();
  const { stores, createTag, updateTag, deleteTag, clearAllOrphanTags, tags } =
    useStores();

  // ── Scalable Server-Side Filters ─────────────────────────────────────────
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input to prevent database spam
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStoreId, debouncedSearch]);

  // ── Local Paginated State & Total Counts ─────────────────────────────────
  const [localTags, setLocalTags] = useState<Tag[]>([]);
  const [totalMatchingTags, setTotalMatchingTags] = useState(0);
  const [isFetchingTags, setIsFetchingTags] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(totalMatchingTags / TAGS_PAGE_SIZE));

  // ── Scalable Usage Counting ──────────────────────────────────────────────
  const [tagUsageMap, setTagUsageMap] = useState<Record<string, number>>({});

  const loadTags = useCallback(async () => {
    if (!user) return;
    setIsFetchingTags(true);

    const offset = (currentPage - 1) * TAGS_PAGE_SIZE;

    try {
      // By adding { count: "exact" }, Supabase returns the total matching rows alongside the paginated data
      let query = supabase
        .from("tags" as any)
        .select("*", { count: "exact" })
        .eq("owner_id", user.id);

      if (selectedStoreId !== "all") {
        query = query.eq("store_id", selectedStoreId);
      }
      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,category.ilike.%${debouncedSearch}%`,
        );
      }

      const { data, count, error } = await query
        .order("name", { ascending: true })
        .range(offset, offset + TAGS_PAGE_SIZE - 1);

      if (error) throw error;

      const fetchedTags = (data as unknown as Tag[]) || [];
      setLocalTags(fetchedTags);
      if (count !== null) setTotalMatchingTags(count);
    } catch (err) {
      console.error("Error fetching tags:", err);
    } finally {
      setIsFetchingTags(false);
    }
  }, [user, selectedStoreId, debouncedSearch, currentPage]);

  // Trigger fetch when filters or page change
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Scalable Usage Fetcher: Only fetches counts for tags CURRENTLY rendered on screen
  useEffect(() => {
    let isMounted = true;
    const fetchUsage = async () => {
      const counts: Record<string, number> = {};

      const tagsToFetch = localTags.filter(
        (t) => tagUsageMap[t.id] === undefined,
      );
      if (tagsToFetch.length === 0) return;

      // Fire tiny HEAD requests in parallel
      await Promise.all(
        tagsToFetch.map(async (tag) => {
          const { count } = await supabase
            .from("product_tags" as any)
            .select("*", { count: "exact", head: true })
            .eq("tag_id", tag.id);
          counts[tag.id] = count || 0;
        }),
      );

      if (isMounted) {
        setTagUsageMap((prev) => ({ ...prev, ...counts }));
      }
    };

    fetchUsage();
    return () => {
      isMounted = false;
    };
  }, [localTags, tagUsageMap]);

  // ── Modals & Forms ───────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagCategory, setTagCategory] = useState("");
  const [createStoreId, setCreateStoreId] = useState("");

  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const getTagUsage = (tagId: string) => {
    return { productCount: tagUsageMap[tagId] || 0 };
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

    setIsActionLoading(true);
    try {
      if (editingTag) {
        await updateTag(editingTag.id, {
          name: tagName.trim(),
          category: tagCategory.trim() || undefined,
          is_hard_constraint: false,
        });

        setLocalTags((prev) =>
          prev.map((t) =>
            t.id === editingTag.id
              ? {
                  ...t,
                  name: tagName.trim(),
                  category: tagCategory.trim() || undefined,
                }
              : t,
          ),
        );
        trackEvent("Tag Updated", {
          tagId: editingTag.id,
          tagName: tagName.trim(),
        });
      } else {
        await createTag(
          createStoreId || "",
          tagName.trim(),
          tagCategory.trim(),
          false,
        );
        setCurrentPage(1); // Jump to first page to see newly created tag
        loadTags();
        trackEvent("Tag Created", {
          tagName: tagName.trim(),
          storeId: createStoreId || null,
        });
      }
      setIsCreateOpen(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) return;

    setIsActionLoading(true);
    try {
      await deleteTag(deletingTag.id);

      trackEvent("Tag Deleted", {
        tagId: deletingTag.id,
        tagName: deletingTag.name,
      });
      setDeletingTag(null);

      // If we deleted the last item on the current page, go back a page
      if (localTags.length === 1 && currentPage > 1) {
        setCurrentPage((prev) => prev - 1);
      } else {
        loadTags(); // Reload current page
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCleanupOrphans = async () => {
    setIsCleaningUp(true);
    try {
      await clearAllOrphanTags();
      setCurrentPage(1);
      loadTags();
      setShowCleanupConfirm(false);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const getStoreName = (storeId: string | null) => {
    if (!storeId) return "System Library";
    return stores.find((s) => s.id === storeId)?.name || "Unknown Store";
  };

  // We use the global tags array purely to see if there are any orphans overall
  const orphanTagsCount = useMemo(
    () => tags.filter((t) => !t.store_id).length,
    [tags],
  );

  return (
    <div className="space-y-6 max-w-8xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="mt-1 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-3">
              <TagsIcon className="h-6 w-6 text-primary" />
              Tags
              {!isFetchingTags && (
                <Badge
                  variant="secondary"
                  className="text-sm font-normal bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  {totalMatchingTags} Total
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage tags across all your stores to organize and filter
              products.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {orphanTagsCount > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowCleanupConfirm(true)}
              className="gap-2 shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Cleanup Junk ({orphanTagsCount})
            </Button>
          )}
          <Button
            onClick={handleOpenCreate}
            className="gap-2 shrink-0 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Tag
          </Button>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-card border border-border rounded-xl p-3 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tags by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-input focus:ring-primary/20"
          />
        </div>

        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-full pl-9 bg-background">
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
      </div>

      {/* ── Tags Table ── */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Tag Directory</CardTitle>
              <CardDescription className="mt-1">
                {isFetchingTags
                  ? "Loading..."
                  : totalMatchingTags === 0
                    ? "No tags found"
                    : `Showing tags ${(currentPage - 1) * TAGS_PAGE_SIZE + 1} - ${Math.min(currentPage * TAGS_PAGE_SIZE, totalMatchingTags)} of ${totalMatchingTags}`}
              </CardDescription>
            </div>
            {isFetchingTags && (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isFetchingTags && localTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary/60" />
              <p className="text-sm font-medium">Fetching tags...</p>
            </div>
          ) : localTags.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
                <TagIcon className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No tags found</h3>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                {searchQuery
                  ? "Try adjusting your search or store filters."
                  : "You haven't created any tags yet. Tags help organize your products."}
              </p>
              <Button
                onClick={handleOpenCreate}
                variant={searchQuery ? "outline" : "default"}
              >
                {searchQuery ? "Clear Search" : "Create your first tag"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/20 border-b border-border">
                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">
                      Category
                    </th>
                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">
                      Location
                    </th>
                    <th className="text-left py-3 px-6 font-semibold text-muted-foreground">
                      Usage
                    </th>
                    <th className="text-right py-3 px-6 font-semibold text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {localTags.map((tag) => {
                    const usage = getTagUsage(tag.id);
                    return (
                      <tr
                        key={tag.id}
                        className="hover:bg-muted/40 transition-colors group"
                      >
                        <td className="py-3 px-6 font-medium text-foreground">
                          {tag.name}
                        </td>
                        <td className="py-3 px-6">
                          {tag.category ? (
                            <Badge
                              variant="outline"
                              className="font-normal text-xs bg-background"
                            >
                              {tag.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-muted-foreground">
                          {getStoreName(tag.store_id)}
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Box className="w-3.5 h-3.5" />
                            <span>{usage.productCount}</span>
                          </div>
                        </td>
                        <td className="py-2 px-6">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEdit(tag)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingTag(tag)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ── Page Controls ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10">
                  <span className="text-sm text-muted-foreground hidden sm:block">
                    Showing {(currentPage - 1) * TAGS_PAGE_SIZE + 1} to{" "}
                    {Math.min(currentPage * TAGS_PAGE_SIZE, totalMatchingTags)}{" "}
                    of {totalMatchingTags} tags
                  </span>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || isFetchingTags}
                      className="gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm font-medium px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages || isFetchingTags}
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Edit Tag" : "Create New Tag"}
            </DialogTitle>
            <DialogDescription>
              {editingTag
                ? "Update the tag details below."
                : "Create a new tag to organize your products and zones."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">
                Tag Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tag-name"
                placeholder="e.g., No-sugar, Vegan, Best Seller"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                className="focus-visible:ring-primary/20"
              />
            </div>
            {!editingTag && (
              <div className="space-y-2">
                <Label>Location Assignment</Label>
                <Select value={createStoreId} onValueChange={setCreateStoreId}>
                  <SelectTrigger className="focus:ring-primary/20">
                    <SelectValue placeholder="System Library (Available to all stores)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      System Library (All Stores)
                    </SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Assign to a specific store, or leave blank to make it
                  available globally.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tag-category">
                Category{" "}
                <span className="text-muted-foreground font-normal">
                  (Optional)
                </span>
              </Label>
              <Input
                id="tag-category"
                placeholder="e.g., Dietary, Mood, Event"
                value={tagCategory}
                onChange={(e) => setTagCategory(e.target.value)}
                className="focus-visible:ring-primary/20"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!tagName.trim() || isActionLoading}
            >
              {isActionLoading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingTag ? "Save Changes" : "Create Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to delete the tag{" "}
              <strong className="text-foreground">"{deletingTag?.name}"</strong>
              ? This will remove it from all products. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setDeletingTag(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isActionLoading}
            >
              {isActionLoading && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cleanup Junk Tags Dialog ── */}
      <Dialog open={showCleanupConfirm} onOpenChange={setShowCleanupConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle>Cleanup Junk Tags</DialogTitle>
            <DialogDescription className="pt-2">
              This will permanently delete all{" "}
              <strong className="text-foreground">{orphanTagsCount}</strong>{" "}
              tags that are not associated with any store. This is usually
              caused by failed imports or old sample data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCleanupConfirm(false)}
              disabled={isCleaningUp}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCleanupOrphans}
              disabled={isCleaningUp}
            >
              {isCleaningUp && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete Junk Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
