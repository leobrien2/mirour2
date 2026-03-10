"use client";

import { useState } from "react";
import { Store } from "@/types/mirour";

interface StoreFormProps {
  initialData?: Store;
  onSubmit: (data: { name: string; location?: string }) => Promise<void>;
  onCancel: () => void;
}

export function StoreForm({ initialData, onSubmit, onCancel }: StoreFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [location, setLocation] = useState(initialData?.location || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit({ name, location });
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card w-full max-w-lg p-6 rounded-xl shadow-lg border border-border">
        <h3 className="text-xl font-bold mb-4">
          {initialData ? "Edit Location" : "Create Location"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="store-name"
              className="block text-sm font-medium mb-1"
            >
              Location Name
            </label>
            <input
              id="store-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background"
              placeholder="e.g. Downtown Branch"
            />
          </div>
          <div>
            <label
              htmlFor="store-location"
              className="block text-sm font-medium mb-1"
            >
              Location
            </label>
            <input
              id="store-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background"
              placeholder="e.g. 123 Main St, New York"
            />
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
