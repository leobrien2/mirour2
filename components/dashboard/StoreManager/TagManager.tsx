"use client";

import { useState } from "react";
import { Store, Tag } from "@/types/mirour";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, X, Tag as TagIcon } from "lucide-react";

interface TagManagerProps {
  store: Store;
  tags: Tag[];
  onCreateTag: (
    name: string,
    category: string,
    isHardConstraint: boolean,
  ) => Promise<void>;
  onDeleteTag?: (tagId: string) => Promise<void>;
}

// Suggested tags to prevent vocabulary drift
const SUGGESTED_TAGS = [
  "Social",
  "Calm",
  "Focus",
  "Energize",
  "Sleep",
  "Relaxation",
  "Party",
  "Wellness",
  "No-sugar",
  "THC-free",
  "Vegan",
  "Gluten-free",
  "Organic",
];

export default function TagManager({
  store,
  tags,
  onCreateTag,
  onDeleteTag,
}: TagManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setIsLoading(true);
    try {
      await onCreateTag(newTagName.trim(), newTagCategory.trim(), false);
      setNewTagName("");
      setNewTagCategory("");
      setShowCustomInput(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAddTag = async (name: string) => {
    setIsLoading(true);
    try {
      await onCreateTag(name, "", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!bulkTagInput.trim()) return;

    setIsLoading(true);
    setBulkStatus(null);
    let imported = 0;
    let skipped = 0;

    try {
      const existingTagNames = new Set(tags.map((t) => t.name.toLowerCase()));

      // Parse input - split by comma or newline
      const tagNames = bulkTagInput
        .split(/[,\n]+/)
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      for (const tagName of tagNames) {
        if (existingTagNames.has(tagName.toLowerCase())) {
          skipped++;
        } else {
          await onCreateTag(tagName, "", false);
          imported++;
          // Small delay to avoid overwhelming the database
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      setBulkStatus(
        `✓ Created ${imported} tags (${skipped} skipped as duplicates)`,
      );
      setBulkTagInput("");
      setTimeout(() => {
        setBulkStatus(null);
        setShowBulkInput(false);
      }, 3000);
    } catch (error) {
      setBulkStatus("✗ Error creating tags. Please try again.");
      setTimeout(() => setBulkStatus(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const existingTagNames = new Set(tags.map((t) => t.name.toLowerCase()));
  const availableSuggestions = SUGGESTED_TAGS.filter(
    (name) => !existingTagNames.has(name.toLowerCase()),
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <TagIcon className="h-4 w-4" />
          Manage Tags ({tags.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tag Management: {store.name}</DialogTitle>
          <DialogDescription>
            Create and manage tags for products and zones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bulk Tag Creator */}
          {!showBulkInput ? (
            <Button
              onClick={() => setShowBulkInput(true)}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Bulk Create Tags
            </Button>
          ) : (
            <Card className="bg-muted/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Bulk Create Tags</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowBulkInput(false);
                      setBulkTagInput("");
                      setBulkStatus(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Tag Names (comma or newline separated)</Label>
                  <textarea
                    className="w-full min-h-[100px] p-2 rounded-md border bg-background"
                    placeholder="Social, Calm, Energize&#10;No-sugar, Vegan"
                    value={bulkTagInput}
                    onChange={(e) => setBulkTagInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter multiple tags separated by commas or line breaks
                  </p>
                </div>
                <Button
                  onClick={handleBulkCreate}
                  disabled={isLoading || !bulkTagInput.trim()}
                  className="w-full"
                >
                  Create{" "}
                  {bulkTagInput.split(/[,\n]+/).filter((s) => s.trim()).length}{" "}
                  Tags
                </Button>
                {bulkStatus && (
                  <p className="text-sm font-medium text-center">
                    {bulkStatus}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Suggested Tags Section */}
          {availableSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Suggested Tags</CardTitle>
                <CardDescription>
                  Quick-add common tags to prevent duplicates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {availableSuggestions.map((name) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAddTag(name)}
                      disabled={isLoading}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      {name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create Custom Tag */}
          {!showCustomInput ? (
            <Button
              variant="outline"
              onClick={() => setShowCustomInput(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Tag
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Create Custom Tag</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tagName">Tag Name *</Label>
                  <Input
                    id="tagName"
                    placeholder="e.g., Low-calorie"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagCategory">Category (optional)</Label>
                  <Input
                    id="tagCategory"
                    placeholder="e.g., Dietary, Mood, Effect"
                    value={newTagCategory}
                    onChange={(e) => setNewTagCategory(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isLoading}
                    className="flex-1"
                  >
                    Create Tag
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCustomInput(false);
                      setNewTagName("");
                      setNewTagCategory("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Tags */}
          <div>
            <h3 className="text-sm font-medium mb-2">Tags ({tags.length})</h3>
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags yet</p>
              ) : (
                tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="gap-1 px-3 py-1"
                  >
                    {tag.name}
                    {tag.category && (
                      <span className="text-xs opacity-75">
                        ({tag.category})
                      </span>
                    )}
                    {onDeleteTag && (
                      <X
                        className="h-3 w-3 ml-1 cursor-pointer hover:opacity-75"
                        onClick={() => onDeleteTag(tag.id)}
                      />
                    )}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
