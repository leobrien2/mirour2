"use client";

import { WelcomeSection, FlowNode, generateSectionId, ProductItem } from '@/types/mirour';
import { Plus, X, ChevronDown, ChevronUp, ExternalLink, Type, ListChecks, Upload, Loader2, ShoppingBag } from 'lucide-react';
import { useState, useRef } from 'react';
import { uploadSectionImage, deleteFormImage } from '@/lib/storage';

type SectionsEditorProps = {
  sections: WelcomeSection[];
  allNodes: FlowNode[];
  onChange: (sections: WelcomeSection[]) => void;
  formId?: string;
};

export function SectionsEditor({ sections, allNodes, onChange, formId }: SectionsEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const generateProductId = () => 'prod-' + Math.random().toString(36).substring(2, 9);

  const handleAddSection = (type: WelcomeSection['type']) => {
    const newSection: WelcomeSection = {
      id: generateSectionId(),
      type,
      ...(type === 'content' && { text: '' }),
      ...(type === 'link' && { linkUrl: '', linkTitle: 'Learn More' }),
      ...(type === 'options' && { options: [{ label: 'Option 1' }, { label: 'Option 2' }] }),
      ...(type === 'product' && { products: [
        { id: generateProductId(), name: 'Product 1' },
        { id: generateProductId(), name: 'Product 2' }
      ] }),
    };
    onChange([...sections, newSection]);
    setExpandedId(newSection.id);
  };

  const handleUpdateSection = (id: string, updates: Partial<WelcomeSection>) => {
    onChange(sections.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleDeleteSection = (id: string) => {
    onChange(sections.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    onChange(newSections);
  };

  // Filter to only show nodes that can be navigated to
  const navigableNodes = allNodes.filter(n => 
    n.type === 'question' || n.type === 'message' || n.type === 'customer-info' || n.type === 'complete'
  );

  return (
    <div className="space-y-3">
      <label className="block text-foreground font-medium">Custom Sections</label>
      
      {sections.length > 0 && (
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div key={section.id} className="bg-secondary rounded-xl border border-primary/10 overflow-hidden">
              {/* Section Header */}
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-primary/5 transition-colors"
                onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
              >
                <div className="flex items-center gap-2">
                  {section.type === 'content' && <Type className="w-4 h-4 text-muted-foreground" />}
                  {section.type === 'link' && <ExternalLink className="w-4 h-4 text-muted-foreground" />}
                  {section.type === 'options' && <ListChecks className="w-4 h-4 text-muted-foreground" />}
                  {section.type === 'product' && <ShoppingBag className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-sm text-foreground capitalize">{section.type === 'product' ? 'Products' : section.type} Section</span>
                </div>
                <div className="flex items-center gap-1">
                  {index > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveSection(index, 'up'); }}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  )}
                  {index < sections.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMoveSection(index, 'down'); }}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id); }}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Section Content - Expanded */}
              {expandedId === section.id && (
                <div className="p-3 pt-0 space-y-3 border-t border-primary/10">
                  {section.type === 'content' && (
                    <ContentSectionEditor 
                      section={section} 
                      onUpdate={(updates) => handleUpdateSection(section.id, updates)}
                      formId={formId}
                      sectionId={section.id}
                    />
                  )}
                  {section.type === 'link' && (
                    <LinkSectionEditor 
                      section={section} 
                      onUpdate={(updates) => handleUpdateSection(section.id, updates)} 
                    />
                  )}
                  {section.type === 'options' && (
                    <OptionsSectionEditor 
                      section={section} 
                      allNodes={navigableNodes}
                      onUpdate={(updates) => handleUpdateSection(section.id, updates)} 
                    />
                  )}
                  {section.type === 'product' && (
                    <ProductSectionEditor 
                      section={section} 
                      onUpdate={(updates) => handleUpdateSection(section.id, updates)}
                      formId={formId}
                      sectionId={section.id}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Section Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleAddSection('content')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary/10 hover:bg-primary/20 text-foreground rounded-lg transition-colors"
        >
          <Type className="w-3.5 h-3.5" />
          Add Content
        </button>
        <button
          onClick={() => handleAddSection('link')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary/10 hover:bg-primary/20 text-foreground rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Add Link
        </button>
        <button
          onClick={() => handleAddSection('options')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary/10 hover:bg-primary/20 text-foreground rounded-lg transition-colors"
        >
          <ListChecks className="w-3.5 h-3.5" />
          Add Options
        </button>
        <button
          onClick={() => handleAddSection('product')}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary/10 hover:bg-primary/20 text-foreground rounded-lg transition-colors"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Add Products
        </button>
      </div>
    </div>
  );
}

// Content Section Editor
function ContentSectionEditor({ 
  section, 
  onUpdate,
  formId,
  sectionId
}: { 
  section: WelcomeSection; 
  onUpdate: (updates: Partial<WelcomeSection>) => void;
  formId?: string;
  sectionId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    try {
      // Try to upload to storage if formId is available
      if (formId) {
        const publicUrl = await uploadSectionImage(file, formId, sectionId);
        if (publicUrl) {
          onUpdate({ imageUrl: publicUrl });
          setUploading(false);
          return;
        }
      }
      
      // Fallback to base64 if no formId or upload fails
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdate({ imageUrl: event.target?.result as string });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      // Fallback to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdate({ imageUrl: event.target?.result as string });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = async () => {
    // Try to delete from storage if it's a storage URL
    if (section.imageUrl && section.imageUrl.includes('form-uploads')) {
      await deleteFormImage(section.imageUrl);
    }
    onUpdate({ imageUrl: undefined });
  };

  return (
    <div className="space-y-3 pt-3">
      <div>
        <label className="block text-sm text-muted-foreground mb-1">Text</label>
        <textarea
          value={section.text || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm resize-none"
          placeholder="Enter content text..."
        />
      </div>
      <div>
        <label className="block text-sm text-muted-foreground mb-1">Image (optional)</label>
        {section.imageUrl ? (
          <div className="relative">
            <img src={section.imageUrl} alt="" className="w-full h-20 object-cover rounded-lg" />
            <button
              onClick={handleRemoveImage}
              disabled={uploading}
              className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-16 border-2 border-dashed border-primary/20 rounded-lg flex items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors text-sm disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
}

// Link Section Editor
function LinkSectionEditor({ 
  section, 
  onUpdate 
}: { 
  section: WelcomeSection; 
  onUpdate: (updates: Partial<WelcomeSection>) => void;
}) {
  return (
    <div className="space-y-3 pt-3">
      <div>
        <label className="block text-sm text-muted-foreground mb-1">Button Text</label>
        <input
          type="text"
          value={section.linkTitle || ''}
          onChange={(e) => onUpdate({ linkTitle: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
          placeholder="e.g., Visit Website"
        />
      </div>
      <div>
        <label className="block text-sm text-muted-foreground mb-1">URL</label>
        <input
          type="url"
          value={section.linkUrl || ''}
          onChange={(e) => onUpdate({ linkUrl: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
          placeholder="https://example.com"
        />
      </div>
    </div>
  );
}

// Options Section Editor
function OptionsSectionEditor({ 
  section,
  allNodes,
  onUpdate 
}: { 
  section: WelcomeSection;
  allNodes: FlowNode[];
  onUpdate: (updates: Partial<WelcomeSection>) => void;
}) {
  const options = section.options || [];

  const handleAddOption = () => {
    onUpdate({ options: [...options, { label: `Option ${options.length + 1}` }] });
  };

  const handleUpdateOption = (index: number, updates: Partial<{ label: string; targetNodeId?: string }>) => {
    const newOptions = options.map((opt, i) => i === index ? { ...opt, ...updates } : opt);
    onUpdate({ options: newOptions });
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 1) return;
    onUpdate({ options: options.filter((_, i) => i !== index) });
  };

  const getNodeLabel = (nodeId: string): string => {
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) return 'Unknown';
    if (node.type === 'question') return node.label || 'Untitled question';
    if (node.type === 'complete') return 'Complete';
    if (node.type === 'customer-info') return 'Customer Info';
    return node.content || 'Untitled';
  };

  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs text-muted-foreground">
        Each option can navigate to a specific step in your flow.
      </p>
      {options.map((option, index) => (
        <div key={index} className="space-y-2 p-2 bg-primary/5 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={option.label}
              onChange={(e) => handleUpdateOption(index, { label: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
              placeholder={`Option ${index + 1}`}
            />
            {options.length > 1 && (
              <button
                onClick={() => handleRemoveOption(index)}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Navigate to:</label>
            <select
              value={option.targetNodeId || ''}
              onChange={(e) => handleUpdateOption(index, { targetNodeId: e.target.value || undefined })}
              className="w-full px-3 py-2 rounded-lg border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-sm"
            >
              <option value="">Continue normally</option>
              {allNodes.map(node => (
                <option key={node.id} value={node.id}>
                  {getNodeLabel(node.id)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button
        onClick={handleAddOption}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-foreground transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add option
      </button>
    </div>
  );
}

// Product Section Editor
function ProductSectionEditor({ 
  section, 
  onUpdate,
  formId,
  sectionId
}: { 
  section: WelcomeSection; 
  onUpdate: (updates: Partial<WelcomeSection>) => void;
  formId?: string;
  sectionId: string;
}) {
  const products = section.products || [];
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const generateProductId = () => 'prod-' + Math.random().toString(36).substring(2, 9);

  const handleAddProduct = () => {
    onUpdate({ products: [...products, { id: generateProductId(), name: `Product ${products.length + 1}` }] });
  };

  const handleUpdateProduct = (productId: string, updates: Partial<ProductItem>) => {
    const newProducts = products.map(p => p.id === productId ? { ...p, ...updates } : p);
    onUpdate({ products: newProducts });
  };

  const handleRemoveProduct = (productId: string) => {
    if (products.length <= 1) return;
    onUpdate({ products: products.filter(p => p.id !== productId) });
  };

  const handleImageUpload = async (productId: string, file: File) => {
    setUploadingId(productId);
    
    try {
      // Try to upload to storage if formId is available
      if (formId) {
        const { uploadSectionImage } = await import('@/lib/storage');
        const publicUrl = await uploadSectionImage(file, formId, `${sectionId}-${productId}`);
        if (publicUrl) {
          handleUpdateProduct(productId, { imageUrl: publicUrl });
          setUploadingId(null);
          return;
        }
      }
      
      // Fallback to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        handleUpdateProduct(productId, { imageUrl: event.target?.result as string });
        setUploadingId(null);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      // Fallback to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        handleUpdateProduct(productId, { imageUrl: event.target?.result as string });
        setUploadingId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs text-muted-foreground">
        Add products to display in a 2-column grid.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {products.map((product) => (
          <div key={product.id} className="p-2 bg-primary/5 rounded-lg space-y-2">
            {/* Product Image */}
            <div className="relative">
              {product.imageUrl ? (
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-white/10">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleUpdateProduct(product.id, { imageUrl: undefined })}
                    className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRefs.current[product.id]?.click()}
                  disabled={uploadingId === product.id}
                  className="w-full aspect-[3/4] border-2 border-dashed border-primary/20 rounded-lg flex items-center justify-center text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {uploadingId === product.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </button>
              )}
              <input
                ref={(el) => { fileInputRefs.current[product.id] = el; }}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(product.id, file);
                }}
                className="hidden"
              />
            </div>
            {/* Product Name */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={product.name}
                onChange={(e) => handleUpdateProduct(product.id, { name: e.target.value })}
                className="flex-1 px-2 py-1 rounded border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-xs"
                placeholder="Name"
              />
              {products.length > 1 && (
                <button
                  onClick={() => handleRemoveProduct(product.id)}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* Product Link */}
            <input
              type="url"
              value={product.linkUrl || ''}
              onChange={(e) => handleUpdateProduct(product.id, { linkUrl: e.target.value })}
              className="w-full px-2 py-1 rounded border-2 border-primary/20 focus:outline-none focus:border-primary bg-card text-xs"
              placeholder="Link (optional)"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleAddProduct}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-foreground transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add product
      </button>
    </div>
  );
}
