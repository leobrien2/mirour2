"use client";

import { useState, useCallback } from "react";
import {
  FlowNode,
  createWelcomeNode,
  createCompleteNode,
  generateNodeId,
  createCustomerInfoNode,
  Form,
} from "@/types/mirour";
import { DashboardForm } from "@/types/dashboard";
import { FlowCanvas } from "./FlowCanvas";
import { NodeEditor } from "./NodeEditor";
import { AddContentModal } from "./AddContentModal";
import { StepPreview } from "./StepPreview";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type FlowBuilderProps = {
  // For creating new forms (after simple creation)
  onCreateForm?: (formData: {
    name: string;
    internal_goal?: string;
    questions: FlowNode[];
    perk: string;
    capture_name: boolean;
    capture_email: boolean;
    capture_phone: boolean;
  }) => Promise<{ error: Error | null; data: any }>;

  // For editing existing forms
  existingForm?: DashboardForm;
  onUpdateForm?: (
    formId: string,
    updates: Partial<Form>,
  ) => Promise<{ error: Error | null }>;
  onDeleteForm?: (formId: string) => Promise<{ error: Error | null }>;

  onSuccess: () => void;
  businessLogo?: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
};

export function FlowBuilder({
  onCreateForm,
  existingForm,
  onUpdateForm,
  onDeleteForm,
  onSuccess,
  businessLogo,
  onDirtyChange,
}: FlowBuilderProps) {
  const isEditMode = !!existingForm;

  // Form settings
  const [formName, setFormName] = useState(existingForm?.name || "");
  const [internalGoal, setInternalGoal] = useState(
    existingForm?.internalGoal || "",
  );
  const [showStartPage, setShowStartPage] = useState<boolean>(
    existingForm?.show_start_page ?? true,
  );

  // Flow nodes - initialize from existing form or defaults
const [nodes, setNodes] = useState<FlowNode[]>(() => {
  if (existingForm?.questions && existingForm.questions.length > 0) {
    return sortNodesByChain(existingForm.questions); // ← sort on load
  }
  return [createWelcomeNode(), createCompleteNode()];
});

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [insertAfterNodeId, setInsertAfterNodeId] = useState<string | null>(
    null,
  );
  const [insertBranchOption, setInsertBranchOption] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  // Panel visibility state
  const [activePanel, setActivePanel] = useState<"flow" | "preview" | "editor">(
    "flow",
  );

  // Find selected node in main nodes or in branches
  const findSelectedNode = (): FlowNode | null => {
    // Check main nodes
    const mainNode = nodes.find((n) => n.id === selectedNodeId);
    if (mainNode) return mainNode;

    // Check branch nodes
    for (const node of nodes) {
      if (node.branches) {
        for (const branch of node.branches) {
          const branchNode = branch.nodes.find((n) => n.id === selectedNodeId);
          if (branchNode) return branchNode;
        }
      }
    }
    return null;
  };

  const selectedNode = findSelectedNode();

  const handleAddNode = (afterNodeId: string, branchOption?: string) => {
    setInsertAfterNodeId(afterNodeId);
    setInsertBranchOption(branchOption || null);
    setShowAddModal(true);
  };
  const defaultNodeMeta: Partial<Record<FlowNode["type"], Partial<FlowNode>>> =
    {
      "product-showcase": {
        showcaseHeader: "Product Showcase",
        showcaseSubheader: "",
      },
      recommendation: { header: "Product Recommendations" },
      message: { header: "Message", content: "" },
      question: { label: "New Question" },
      welcome: { header: "Welcome", buttonText: "Get Started" },
      complete: { header: "Done!" },
    };

  const handleInsertNode = (
    nodeType: FlowNode["type"],
    questionType?: FlowNode["questionType"],
  ) => {
    let newNode: FlowNode;

    if (nodeType === "customer-info") {
      newNode = createCustomerInfoNode();
    } else {
      newNode = {
        id: generateNodeId(),
        type: nodeType,
        questionType,
        label: questionType ? "" : undefined,
        content: nodeType === "message" ? "" : undefined,
        options:
          questionType === "multiple-choice" ||
          questionType === "checkboxes" ||
          questionType === "quiz"
            ? ["Option 1", "Option 2"]
            : undefined,
        optionScores: questionType === "quiz" ? [0, 0] : undefined,
        required: false,
      };
    }

    // Merge default display meta (label, header, etc.) for the node type
    newNode = { ...newNode, ...(defaultNodeMeta[nodeType] ?? {}) };

    // ── Insert into a branch ─────────────────────────────────────────────────
    if (insertBranchOption && insertAfterNodeId) {
      const updatedNodes = nodes.map((n) => {
        if (n.id === insertAfterNodeId && n.branches) {
          return {
            ...n,
            branches: n.branches.map((branch) => {
              if (branch.optionValue === insertBranchOption) {
                return {
                  ...branch,
                  nodes: [...branch.nodes, newNode],
                };
              }
              return branch;
            }),
          };
        }
        return n;
      });
      setNodes(updatedNodes);
      setSelectedNodeId(newNode.id);
      setActivePanel("editor");
      onDirtyChange?.(true);
      autoSave(updatedNodes);

      // ── Insert into main flow ────────────────────────────────────────────────
    } else {
      const insertIndex = nodes.findIndex((n) => n.id === insertAfterNodeId);
      if (insertIndex !== -1) {
        const nodeBefore = nodes[insertIndex];
        const nodeAfter = nodes[insertIndex + 1] ?? null;

        // What was nodeBefore pointing to? That's where newNode should point.
        // Priority: explicit nextNodeId > conditionalNext common target > nodeAfter's id
        let originalNextId: string | undefined = nodeBefore.nextNodeId;

        if (!originalNextId && nodeBefore.conditionalNext?.length) {
          // If ALL conditionalNext entries share the same target, use that
          const targets = [
            ...new Set(nodeBefore.conditionalNext.map((c) => c.nextNodeId)),
          ];
          if (targets.length === 1) originalNextId = targets[0];
        }

        if (!originalNextId && nodeAfter) {
          originalNextId = nodeAfter.id;
        }

        // New node inherits the forward pointer
        newNode = {
          ...newNode,
          nextNodeId: originalNextId ?? undefined,
        };

        // Patch nodeBefore: nextNodeId → newNode
        let updatedNodeBefore: FlowNode = {
          ...nodeBefore,
          nextNodeId: newNode.id,
        };

        // Patch conditionalNext entries that pointed to originalNextId → newNode
        if (nodeBefore.conditionalNext?.length && originalNextId) {
          updatedNodeBefore = {
            ...updatedNodeBefore,
            conditionalNext: nodeBefore.conditionalNext.map((c) =>
              c.nextNodeId === originalNextId
                ? { ...c, nextNodeId: newNode.id }
                : c,
            ),
          };
        }

        const newNodes = [...nodes];
        newNodes[insertIndex] = updatedNodeBefore; // patch nodeBefore in place
        newNodes.splice(insertIndex + 1, 0, newNode); // insert new node after it

        setNodes(newNodes);
        setSelectedNodeId(newNode.id);
        setActivePanel("editor");
        onDirtyChange?.(true);
        autoSave(newNodes);
      }
    }

    setShowAddModal(false);
    setInsertAfterNodeId(null);
    setInsertBranchOption(null);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<FlowNode>) => {
    // Try to update in main nodes
    let found = false;
    const updatedNodes = nodes.map((n) => {
      if (n.id === nodeId) {
        found = true;
        // If updating options on a node with branches, sync branch optionValues
        if (updates.options && n.branches) {
          const newBranches = updates.options.map((opt) => {
            const existing = n.branches?.find((b) => b.optionValue === opt);
            return existing || { optionValue: opt, nodes: [] };
          });
          return { ...n, ...updates, branches: newBranches };
        }
        return { ...n, ...updates };
      }
      return n;
    });

    if (found) {
      setNodes(updatedNodes);
      onDirtyChange?.(true);
      return;
    }

    // Try to update in branches
    setNodes(
      nodes.map((n) => {
        if (n.branches) {
          return {
            ...n,
            branches: n.branches.map((branch) => ({
              ...branch,
              nodes: branch.nodes.map((bn) =>
                bn.id === nodeId ? { ...bn, ...updates } : bn,
              ),
            })),
          };
        }
        return n;
      }),
    );
    onDirtyChange?.(true);
  };

  const handleDeleteNode = (
    nodeId: string,
    branchOption?: string,
    parentNodeId?: string,
  ) => {
    // ── Delete from a branch ─────────────────────────────────────────────────
    if (branchOption && parentNodeId) {
      const updatedNodes = nodes.map((n) => {
        if (n.id === parentNodeId && n.branches) {
          return {
            ...n,
            branches: n.branches.map((branch) => {
              if (branch.optionValue === branchOption) {
                return {
                  ...branch,
                  nodes: branch.nodes.filter((bn) => bn.id !== nodeId),
                };
              }
              return branch;
            }),
          };
        }
        return n;
      });
      setNodes(updatedNodes);
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      onDirtyChange?.(true);
      autoSave(updatedNodes);
      return;
    }

    // ── Delete from main flow ────────────────────────────────────────────────
    const deletedNode = nodes.find((n) => n.id === nodeId);
    const deletedNextId = deletedNode?.nextNodeId;

    let updatedNodes = nodes.filter((n) => n.id !== nodeId);

    updatedNodes = updatedNodes.map((n) => {
      let updates: Partial<FlowNode> = {};

      // Re-bridge nextNodeId: if this node pointed to the deleted node,
      // skip over it and point to whatever the deleted node was pointing to
      if (n.nextNodeId === nodeId) {
        updates.nextNodeId = deletedNextId ?? undefined;
      }

      // Re-bridge conditionalNext: same logic — skip over deleted node
      if (n.conditionalNext && n.conditionalNext.length > 0) {
        const relinked = n.conditionalNext.map((c) =>
          c.nextNodeId === nodeId
            ? { ...c, nextNodeId: deletedNextId ?? "" }
            : c,
        );
        // Also drop any entries that still have no valid target
        const filtered = relinked.filter((c) => c.nextNodeId !== "");
        if (JSON.stringify(filtered) !== JSON.stringify(n.conditionalNext)) {
          updates.conditionalNext = filtered;
        }
      }

      return Object.keys(updates).length > 0 ? { ...n, ...updates } : n;
    });

    setNodes(updatedNodes);
    setSelectedNodeId(null);
    onDirtyChange?.(true);
    autoSave(updatedNodes);
  };
  // Add this helper outside the component
  function rewireNextNodeIds(orderedNodes: FlowNode[]): FlowNode[] {
    return orderedNodes.map((node, index) => {
      const nextNode = orderedNodes[index + 1];

      // Last node — nothing to point to
      if (!nextNode) {
        if (node.nextNodeId) {
          const updates: Partial<FlowNode> = { nextNodeId: undefined };
          if (node.conditionalNext?.length) {
            updates.conditionalNext = node.conditionalNext.map((c) =>
              c.nextNodeId === node.nextNodeId ? { ...c, nextNodeId: "" } : c,
            );
          }
          return { ...node, ...updates };
        }
        return node;
      }

      const oldNextId = node.nextNodeId;
      const newNextId = nextNode.id;

      // Already correct, skip
      if (oldNextId === newNextId) return node;

      const updates: Partial<FlowNode> = { nextNodeId: newNextId };

      // Also re-wire conditionalNext entries that pointed to the old next node
      // (handles question nodes where all branches go to the same target)
      if (node.conditionalNext?.length && oldNextId) {
        const updatedConditional = node.conditionalNext.map((c) =>
          c.nextNodeId === oldNextId ? { ...c, nextNodeId: newNextId } : c,
        );
        updates.conditionalNext = updatedConditional;
      }

      return { ...node, ...updates };
    });
  }
function sortNodesByChain(nodes: FlowNode[]): FlowNode[] {
  if (!nodes.length) return nodes;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const sorted: FlowNode[] = [];
  const visited = new Set<string>();

  // Start from the welcome node
  let current = nodes.find((n) => n.type === "welcome") ?? nodes[0];

  while (current && !visited.has(current.id)) {
    sorted.push(current);
    visited.add(current.id);
    const nextId = current.nextNodeId;
    current = nextId ? nodeMap.get(nextId)! : null!;
  }

  // Append any orphaned nodes not reachable by the chain
  nodes.forEach((n) => {
    if (!visited.has(n.id)) sorted.push(n);
  });

  return sorted;
}

// In useState initializer:


  const handleReorderNodes = (newNodes: FlowNode[]) => {
    const rewired = rewireNextNodeIds(newNodes);
    setNodes(rewired);
    onDirtyChange?.(true);
    autoSave(rewired);
  };

  const handleReorderBranch = (
    parentNodeId: string,
    optionValue: string,
    newBranchNodes: FlowNode[],
  ) => {
    const updatedNodes = nodes.map((node) => {
      if (node.id === parentNodeId && node.branches) {
        return {
          ...node,
          branches: node.branches.map((branch) =>
            branch.optionValue === optionValue
              ? { ...branch, nodes: rewireNextNodeIds(newBranchNodes) }
              : branch,
          ),
        };
      }
      return node;
    });
    setNodes(updatedNodes);
    onDirtyChange?.(true);
    autoSave(updatedNodes);
  };

  // Auto-save function for edit mode
  const autoSave = useCallback(
    async (updatedNodes: FlowNode[]) => {
      if (!isEditMode || !onUpdateForm || !existingForm) return;

      const completeNode = updatedNodes.find((n) => n.type === "complete");
      const customerInfoNode = updatedNodes.find(
        (n) => n.type === "customer-info",
      );

      try {
        const { error } = await onUpdateForm(existingForm.id, {
          name: formName,
          internal_goal: internalGoal || undefined,
          perk: completeNode?.hasPerk ? completeNode?.perk || "" : "",
          questions: updatedNodes,
          capture_name: customerInfoNode?.captureFields?.name || false,
          capture_email: customerInfoNode?.captureFields?.email || false,
          capture_phone: customerInfoNode?.captureFields?.phone || false,
          show_start_page: showStartPage,
        });

        if (error) throw error;
        onDirtyChange?.(false);
        toast.success("Saved");
      } catch (error) {
        toast.error("Failed to save");
      }
    },
    [isEditMode, onUpdateForm, existingForm, formName, internalGoal],
  );

  // Save name only
  const handleSaveName = async () => {
    if (!isEditMode || !onUpdateForm || !existingForm) return;
    if (!formName.trim()) {
      toast.error("Please enter a flow name");
      return;
    }

    setIsSavingName(true);
    try {
      const { error } = await onUpdateForm(existingForm.id, {
        name: formName,
        show_start_page: showStartPage,
      });
      if (error) throw error;
      onDirtyChange?.(false);

      toast.success("Name saved");
    } catch (error) {
      toast.error("Failed to save name");
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle editor save (called when user clicks Save in NodeEditor)
  const handleEditorSave = async () => {
    await autoSave(nodes);
    setSelectedNodeId(null);
    setActivePanel("flow");
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      alert("Please enter a flow name");
      return;
    }

    // Check if there's at least one question node
    const hasQuestion = nodes.some((n) => n.type === "question");
    if (!hasQuestion) {
      alert("Please add at least one question");
      return;
    }

    // Check if all questions have labels
    const emptyQuestion = nodes.find(
      (n) => n.type === "question" && !n.label?.trim(),
    );
    if (emptyQuestion) {
      alert("Please fill in all question labels");
      setSelectedNodeId(emptyQuestion.id);
      return;
    }

    // Extract perk from complete node
    const completeNode = nodes.find((n) => n.type === "complete");
    const perk = completeNode?.hasPerk ? completeNode?.perk || "" : "";

    // Extract customer info capture settings
    const customerInfoNode = nodes.find((n) => n.type === "customer-info");
    const captureName = customerInfoNode?.captureFields?.name || false;
    const captureEmail = customerInfoNode?.captureFields?.email || false;
    const capturePhone = customerInfoNode?.captureFields?.phone || false;

    setIsSubmitting(true);

    try {
      if (isEditMode && onUpdateForm && existingForm) {
        // Update existing form
        const { error } = await onUpdateForm(existingForm.id, {
          name: formName,
          internal_goal: internalGoal || undefined,
          perk,
          questions: nodes,
          capture_name: captureName,
          capture_email: captureEmail,
          capture_phone: capturePhone,
          show_start_page: showStartPage,
        });

        if (error) throw error;
        onDirtyChange?.(false);
      } else if (onCreateForm) {
        // Create new form
        const { error } = await onCreateForm({
          name: formName,
          internal_goal: internalGoal || undefined,
          perk,
          questions: nodes,
          capture_name: captureName,
          capture_email: captureEmail,
          capture_phone: capturePhone,
        });

        if (error) throw error;
        onDirtyChange?.(false);
      }
      onSuccess();
    } catch (error) {
      alert(
        isEditMode
          ? "Failed to update flow. Please try again."
          : "Failed to create flow. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteForm = async () => {
    if (!isEditMode || !onDeleteForm || !existingForm) return;

    try {
      const { error } = await onDeleteForm(existingForm.id);
      if (error) throw error;
      onSuccess();
    } catch (error) {
      toast.error("Failed to delete flow");
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        {/* Form name - edit mode: inline editable, create mode: input field */}
        {isEditMode ? (
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                onDirtyChange?.(true);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              placeholder="Flow name..."
              className="text-3xl font-bold text-foreground bg-card border-border rounded-2xl px-5 py-3 outline-none focus:border-primary flex-1"
            />

            <div className="flex items-center gap-4 bg-card border-2 border-border px-5 py-3 rounded-2xl">
              <span className="text-base font-medium text-foreground whitespace-nowrap">
                Start Page
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowStartPage(!showStartPage);
                  onDirtyChange?.(true);
                }}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                  showStartPage ? "bg-primary" : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    showStartPage ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleSaveName}
              disabled={isSavingName}
              className="px-6 py-3 text-base font-medium bg-foreground text-background rounded-2xl hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {isSavingName ? "Saving..." : "Save"}
            </button>
          </div>
        ) : (
          <>
            {/* Create mode - show input and create button */}
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Flow name..."
              className="text-3xl font-bold text-foreground bg-card border-2 border-primary/20 rounded-2xl px-5 py-4 outline-none w-full placeholder:text-muted-foreground/50 focus:border-primary transition-colors mb-4"
            />
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-foreground text-background font-semibold text-lg rounded-2xl hover:bg-foreground/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Flow"}
            </button>
          </>
        )}
      </div>

      {/* Panel Toggle - only show back button when not on flow */}
      {activePanel !== "flow" && (
        <div className="mb-4">
          <button
            onClick={() => setActivePanel("flow")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-card border border-primary/20 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Flow
          </button>
        </div>
      )}

      {/* Single Panel Content */}
      <div className="pb-8">
        {/* Flow Panel */}
        {activePanel === "flow" && (
          <div className="bg-card rounded-3xl border-2 border-primary/10 overflow-hidden animate-fade-in">
            <div className="bg-secondary p-4 border-b border-primary/10">
              <h2 className="font-medium text-foreground">Flow</h2>
            </div>
            <div className="p-4">
              <FlowCanvas
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => {
                  setSelectedNodeId(id);
                  setActivePanel("preview");
                }}
                onEditNode={(id) => {
                  setSelectedNodeId(id);
                  setActivePanel("editor");
                }}
                onAddNode={handleAddNode}
                onReorder={handleReorderNodes}
                onReorderBranch={handleReorderBranch}
                onDeleteNode={handleDeleteNode}
              />
            </div>
          </div>
        )}

        {/* Preview Panel */}
        {activePanel === "preview" && (
          <div className="bg-card rounded-3xl border-2 border-primary/10 overflow-hidden animate-fade-in">
            <div className="bg-secondary p-4 border-b border-primary/10">
              <h2 className="font-medium text-foreground text-center">
                Preview
              </h2>
            </div>
            <div className="p-4">
              <StepPreview
                node={selectedNode}
                formName={formName}
                businessLogo={businessLogo}
              />
            </div>
          </div>
        )}

        {/* Editor Panel */}
        {activePanel === "editor" && (
          <div className="bg-card rounded-3xl border-2 border-primary/10 overflow-hidden animate-fade-in">
            <div className="bg-secondary p-4 border-b border-primary/10">
              <h2 className="font-medium text-foreground text-center">
                {selectedNode ? "Edit Step" : "Select a step"}
              </h2>
            </div>
            <div className="p-6">
              {selectedNode ? (
                <NodeEditor
                  node={selectedNode}
                  allNodes={nodes}
                  onUpdate={(updates) =>
                    handleUpdateNode(selectedNode.id, updates)
                  }
                  onDelete={() => handleDeleteNode(selectedNode.id)}
                  onBack={() => {
                    setSelectedNodeId(null);
                    setActivePanel("flow");
                  }}
                  onCreateStep={() => handleAddNode(selectedNode.id)}
                  onSave={isEditMode ? handleEditorSave : undefined}
                  formId={existingForm?.id}
                  storeId={existingForm?.store_id}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No step selected</p>
                  <button
                    onClick={() => setActivePanel("flow")}
                    className="text-primary hover:underline"
                  >
                    Go to Flow to select a step
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Flow Section - Edit Mode Only */}
      {isEditMode && onDeleteForm && (
        <div className="mt-8 pt-6 border-t border-destructive/20">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center justify-center gap-2 py-3 px-4 text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-xl font-medium transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete Flow
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{formName || "this flow"}" and
                  all its responses. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteForm}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Add Content Modal */}
      <AddContentModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setInsertAfterNodeId(null);
        }}
        onSelect={handleInsertNode}
        existingNodeTypes={nodes.map((n) => n.type)}
      />
    </div>
  );
}
