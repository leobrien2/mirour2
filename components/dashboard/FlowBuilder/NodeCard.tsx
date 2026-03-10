"use client";

import { FlowNode } from "@/types/mirour";
import {
  MessageCircle,
  HelpCircle,
  Type,
  Star,
  CheckSquare,
  List,
  Image,
  Hand,
  User,
  PartyPopper,
  GitBranch,
  Pencil,
  Trophy,
  ShoppingBag,
} from "lucide-react";

type NodeCardProps = {
  node: FlowNode;
  isSelected: boolean;
  onClick: () => void;
  onEdit?: () => void;
  allNodes?: FlowNode[];
};

const nodeIcons: Record<string, React.ElementType> = {
  welcome: Hand,
  message: MessageCircle,
  complete: PartyPopper,
  "customer-info": User,
  "short-answer": Type,
  "long-answer": Type,
  rating: Star,
  "multiple-choice": CheckSquare,
  checkboxes: List,
  photo: Image,
  quiz: Trophy,
  recommendation: Star,
  "product-showcase": ShoppingBag, // ← ADD
};

const nodeLabels: Record<string, string> = {
  welcome: "Welcome",
  message: "Content Card",
  complete: "Complete",
  "customer-info": "Customer Info",
  "short-answer": "Text",
  "long-answer": "Long Text",
  rating: "Rating",
  "multiple-choice": "Choice",
  checkboxes: "Multi-Select",
  photo: "Photo",
  quiz: "Quiz",
  recommendation: "Product Recs",
  "product-showcase": "Product Showcase", // ← ADD
};

export function NodeCard({ node, isSelected, onClick, onEdit }: NodeCardProps) {
  const iconKey = node.type === "question" ? node.questionType : node.type;
  const Icon = nodeIcons[iconKey || "message"] || HelpCircle;
  const typeLabel =
    node.type === "question"
      ? nodeLabels[node.questionType || "short-answer"]
      : nodeLabels[node.type] || node.type; // ← fallback to raw type instead of undefined

  const getDisplayText = () => {
    if (node.type === "question") return node.label || "Untitled question";
    if (node.type === "welcome") return node.content || "Welcome message";
    if (node.type === "complete")
      return node.header || node.content || "Thank you screen";
    if (node.type === "customer-info")
      return node.content || "Capture customer info";
    if (node.type === "message")
      return (
        node.header || node.subheader || node.content || "Untitled content card"
      );
    if (node.type === "recommendation")
      return node.header || node.content || "Product Recommendations";
    if (node.type === "product-showcase")
      // ← ADD
      return (
        node.showcaseHeader || node.showcaseSubheader || "Product Showcase"
      );
    return node.content || node.header || "Untitled"; // ← improved fallback
  };

  const displayText = getDisplayText();
  const hasConditionalLogic =
    node.hasConditionalLogic && node.options && node.options.length > 0;
  const isQuizQuestion = node.questionType === "quiz";
  const isScoreResult = node.type === "complete" && node.isScoreResult;

  const totalPoints =
    isQuizQuestion && node.optionScores ? Math.max(...node.optionScores) : 0;

  return (
    <div className="relative w-full pr-8">
      <div
        className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
          isSelected
            ? "border-primary bg-primary/5 shadow-lg"
            : "border-primary/10 bg-card hover:border-primary/30"
        }`}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl flex-shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {typeLabel}
              </p>
              {hasConditionalLogic && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px]">
                  <GitBranch className="w-2.5 h-2.5" />
                  Branching
                </span>
              )}
              {isQuizQuestion && totalPoints > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[10px]">
                  <Trophy className="w-2.5 h-2.5" />
                  {totalPoints} pts max
                </span>
              )}
              {isScoreResult && node.scoreThreshold && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[10px]">
                  <Trophy className="w-2.5 h-2.5" />
                  {node.scoreThreshold.min}-{node.scoreThreshold.max}
                </span>
              )}
            </div>
            <p className="text-foreground mt-1 line-clamp-2 break-words">
              {displayText}
            </p>
          </div>
        </div>
      </div>
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="absolute right-0 top-2 w-7 h-7 bg-background text-muted-foreground border border-border rounded-full flex items-center justify-center shadow-sm hover:text-primary hover:border-primary transition-all"
          title="Edit step"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
