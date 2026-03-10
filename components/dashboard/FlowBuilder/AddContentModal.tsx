"use client";

import { FlowNode, QuestionType, FlowNodeType } from "@/types/mirour";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Type,
  Star,
  CheckSquare,
  List,
  Image,
  MessageCircle,
  User,
  PartyPopper,
  Hand,
  Trophy,
  ShoppingBag,
} from "lucide-react";

type AddContentModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (nodeType: FlowNode["type"], questionType?: QuestionType) => void;
  existingNodeTypes: FlowNodeType[];
};

type ContentItem = {
  type: FlowNode["type"];
  questionType?: QuestionType;
  label: string;
  icon: React.ElementType;
};

export function AddContentModal({
  open,
  onClose,
  onSelect,
  existingNodeTypes,
}: AddContentModalProps) {
  const hasCustomerInfo = existingNodeTypes.includes("customer-info");

  const contactItems: ContentItem[] = [
    ...(!hasCustomerInfo
      ? [{ type: "customer-info" as const, label: "Customer Info", icon: User }]
      : []),
  ];

  const questionItems: ContentItem[] = [
    {
      type: "question",
      questionType: "multiple-choice",
      label: "Select One",
      icon: CheckSquare,
    },
    {
      type: "question",
      questionType: "checkboxes",
      label: "Multi-Select",
      icon: List,
    },
    { type: "question", questionType: "rating", label: "Rating", icon: Star },
    { type: "question", questionType: "quiz", label: "Quiz", icon: Trophy },
    {
      type: "question",
      questionType: "short-answer",
      label: "Text Input",
      icon: Type,
    },
    {
      type: "question",
      questionType: "long-answer",
      label: "Paragraph",
      icon: Type,
    },
    {
      type: "question",
      questionType: "photo",
      label: "Photo Upload",
      icon: Image,
    },
  ];

const otherItems: ContentItem[] = [
  { type: "welcome", label: "Welcome Card", icon: Hand },
  { type: "message", label: "Content Card", icon: MessageCircle },
  { type: "product-showcase", label: "Product Showcase", icon: ShoppingBag }, // ← NEW
  { type: "recommendation", label: "Product Recs", icon: Star },
  { type: "complete", label: "Complete Page", icon: PartyPopper },
];

  const handleSelect = (item: ContentItem) => {
    onSelect(item.type, item.questionType);
    onClose();
  };

  const renderItem = (item: ContentItem) => (
    <button
      key={`${item.type}-${item.questionType || ""}`}
      onClick={() => handleSelect(item)}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/80 transition-colors text-left"
    >
      <div className="p-2 rounded-lg bg-secondary text-primary">
        <item.icon className="w-4 h-4" />
      </div>
      <span className="font-medium text-foreground text-sm">{item.label}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl p-6">
        <VisuallyHidden>
          <DialogTitle>Add Content</DialogTitle>
        </VisuallyHidden>
        <div className="grid grid-cols-3 gap-6">
          {/* Contact Info Column */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Contact
            </h3>
            <div className="space-y-1">
              {contactItems.map(renderItem)}
              {contactItems.length === 0 && (
                <p className="text-xs text-muted-foreground/60 italic p-2">
                  Already added
                </p>
              )}
            </div>
          </div>

          {/* Questions Column */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Questions
            </h3>
            <div className="space-y-1">{questionItems.map(renderItem)}</div>
          </div>

          {/* Other Column */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Other
            </h3>
            <div className="space-y-1">{otherItems.map(renderItem)}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
