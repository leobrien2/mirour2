"use client";

import { useId } from 'react';
import { FlowNode } from '@/types/mirour';
import { NodeCard } from './NodeCard';
import { Plus, Pencil, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type BranchColumnProps = {
  optionValue: string;
  nodes: FlowNode[];
  allNodes: FlowNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onEditNode: (id: string) => void;
  onAddNode: () => void;
  onReorderBranch: (nodes: FlowNode[]) => void;
  colorIndex: number;
};

const branchColors = [
  { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', pill: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', pill: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
  { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', pill: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
  { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', pill: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' },
  { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', pill: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300' },
  { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', pill: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300' },
];

type SortableBranchNodeProps = {
  node: FlowNode;
  allNodes: FlowNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onEditNode: (id: string) => void;
};

function SortableBranchNode({
  node,
  allNodes,
  selectedNodeId,
  onSelectNode,
  onEditNode,
}: SortableBranchNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className="flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <div className="flex-1">
          <NodeCard
            node={node}
            isSelected={selectedNodeId === node.id}
            onClick={() => onSelectNode(node.id)}
            allNodes={allNodes}
          />
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEditNode(node.id);
        }}
        className="absolute -right-2 -top-2 w-7 h-7 bg-background text-muted-foreground border border-border rounded-full flex items-center justify-center shadow-sm hover:text-primary hover:border-primary transition-all"
        title="Edit step"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function BranchColumn({
  optionValue,
  nodes,
  allNodes,
  selectedNodeId,
  onSelectNode,
  onEditNode,
  onAddNode,
  onReorderBranch,
  colorIndex,
}: BranchColumnProps) {
  const colors = branchColors[colorIndex % branchColors.length];
  const dndContextId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((n) => n.id === active.id);
      const newIndex = nodes.findIndex((n) => n.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderBranch(arrayMove(nodes, oldIndex, newIndex));
      }
    }
  };

  const sortableIds: UniqueIdentifier[] = nodes.map(n => n.id);

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-3 min-w-[200px]`}>
      {/* Branch header */}
      <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium mb-3 ${colors.pill}`}>
        {optionValue}
      </div>

      {/* Branch nodes - vertical stack with drag-and-drop */}
      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {nodes.map((node) => (
              <SortableBranchNode
                key={node.id}
                node={node}
                allNodes={allNodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onEditNode={onEditNode}
              />
            ))}

            {nodes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No steps yet</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add step button */}
      <button
        onClick={onAddNode}
        className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 text-muted-foreground hover:text-primary hover:bg-background/50 rounded-lg transition-colors text-xs border border-dashed border-current/30"
      >
        <Plus className="w-3 h-3" />
        <span>Add step</span>
      </button>
    </div>
  );
}
