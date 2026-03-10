"use client";

import { FlowNode, Branch } from '@/types/mirour';
import { NodeCard } from './NodeCard';
import { BranchColumn } from './BranchColumn';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
} from '@/components/ui/alert-dialog';

type FlowCanvasProps = {
  nodes: FlowNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onEditNode: (id: string) => void;
  onAddNode: (afterNodeId: string, branchOption?: string) => void;
  onReorder: (nodes: FlowNode[]) => void;
  onReorderBranch: (parentNodeId: string, optionValue: string, nodes: FlowNode[]) => void;
  onDeleteNode: (nodeId: string, branchOption?: string, parentNodeId?: string) => void;
};

type SortableNodeProps = {
  node: FlowNode;
  allNodes: FlowNode[];
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onAddNode: () => void;
  onAddToBranch: (optionValue: string) => void;
  onDelete: () => void;
  onDeleteFromBranch: (nodeId: string, optionValue: string) => void;
  onReorderBranch: (optionValue: string, nodes: FlowNode[]) => void;
  onSelectNode: (id: string) => void;
  onEditNode: (id: string) => void;
  showAddButton: boolean;
  isDraggable: boolean;
  canDelete: boolean;
  selectedNodeId: string | null;
};

function SortableNode({ 
  node, 
  allNodes, 
  isSelected, 
  onClick,
  onEdit,
  onAddNode, 
  onAddToBranch,
  onDelete, 
  onDeleteFromBranch,
  onReorderBranch,
  onSelectNode,
  onEditNode,
  showAddButton, 
  isDraggable, 
  canDelete,
  selectedNodeId 
}: SortableNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: node.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasBranches = node.hasConditionalLogic && node.options && node.options.length > 0;
  const branches = node.branches || [];

  // Get all branch nodes for the allNodes context
  const allBranchNodes = branches.flatMap(b => b.nodes);
  const combinedAllNodes = [...allNodes, ...allBranchNodes];

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 group">
        {isDraggable && (
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className={`flex-1 ${!isDraggable ? 'ml-6' : ''}`}>
          <NodeCard
            node={node}
            isSelected={isSelected}
            onClick={onClick}
            onEdit={onEdit}
            allNodes={allNodes}
          />
        </div>
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this step?</AlertDialogTitle>
                <AlertDialogDescription>
                  {node.hasConditionalLogic && node.branches && node.branches.some(b => b.nodes.length > 0)
                    ? 'This will also delete all conditional branches and their steps. This action cannot be undone.'
                    : 'This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Visual Branching Area */}
      {hasBranches && (
        <div className="mt-3 ml-6">
          {/* Branch columns - horizontal row */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {node.options?.map((option, index) => {
              const branch = branches.find(b => b.optionValue === option);
              const branchNodes = branch?.nodes || [];

              return (
                <BranchColumn
                  key={option}
                  optionValue={option}
                  nodes={branchNodes}
                  allNodes={combinedAllNodes}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={onSelectNode}
                  onEditNode={onEditNode}
                  onAddNode={() => onAddToBranch(option)}
                  onReorderBranch={(newNodes) => onReorderBranch(option, newNodes)}
                  colorIndex={index}
                />
              );
            })}
          </div>
        </div>
      )}
      
      {showAddButton && !hasBranches && (
        <div className="flex justify-center py-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddNode();
            }}
            className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
          >
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-current flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-sm">Add step</span>
          </button>
        </div>
      )}

      {/* Add button after branches merge */}
      {hasBranches && showAddButton && (
        <div className="flex justify-center py-2 ml-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddNode();
            }}
            className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-colors"
          >
            <div className="w-7 h-7 rounded-full border-2 border-dashed border-current flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-sm">Add step</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function FlowCanvas({ nodes, selectedNodeId, onSelectNode, onEditNode, onAddNode, onReorder, onReorderBranch, onDeleteNode }: FlowCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((n) => n.id === active.id);
      const newIndex = nodes.findIndex((n) => n.id === over.id);
      
      // Prevent moving welcome (first) or complete (last) nodes
      const activeNode = nodes[oldIndex];
      const overNode = nodes[newIndex];
      
      if (activeNode.type === 'welcome' || activeNode.type === 'complete') return;
      if (overNode.type === 'welcome' || overNode.type === 'complete') return;
      
      onReorder(arrayMove(nodes, oldIndex, newIndex));
    }
  };

  // Get sortable node IDs (exclude welcome and complete)
  const sortableIds = nodes
    .filter(n => n.type !== 'welcome' && n.type !== 'complete')
    .map(n => n.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {nodes.map((node) => {
            const showAddButton = node.type !== 'complete';
            const isDraggable = node.type !== 'welcome' && node.type !== 'complete';
            const canDelete = true; // All nodes can be deleted
            
            return (
              <SortableNode
                key={node.id}
                node={node}
                allNodes={nodes}
                isSelected={selectedNodeId === node.id}
                onClick={() => onSelectNode(node.id)}
                onEdit={() => onEditNode(node.id)}
                onAddNode={() => onAddNode(node.id)}
                onAddToBranch={(optionValue) => onAddNode(node.id, optionValue)}
                onDelete={() => onDeleteNode(node.id)}
                onDeleteFromBranch={(nodeId, optionValue) => onDeleteNode(nodeId, optionValue, node.id)}
                onReorderBranch={(optionValue, newNodes) => onReorderBranch(node.id, optionValue, newNodes)}
                onSelectNode={onSelectNode}
                onEditNode={onEditNode}
                showAddButton={showAddButton}
                isDraggable={isDraggable}
                canDelete={canDelete}
                selectedNodeId={selectedNodeId}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
