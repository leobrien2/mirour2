"use client";

import { useStores } from "@/hooks/useStores";
import { FlowNode, WelcomeSection } from "@/types/mirour";
import { ChevronRight, Mail, Phone, User, ExternalLink } from "lucide-react";

type StepPreviewProps = {
  node: FlowNode | null;
  formName: string;
  businessLogo?: string | null;
};

export function StepPreview({
  node,
  formName,
  businessLogo,
}: StepPreviewProps) {
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
          <span className="text-3xl">📱</span>
        </div>
        <p className="text-sm">Select a step to preview</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4 overflow-auto">
      {/* Phone Frame - scales to fit container */}
      <div className="relative w-[260px] h-[520px] max-h-[calc(100%-2rem)] bg-mirour-dark rounded-[2.5rem] shadow-2xl border-4 border-muted/30 flex flex-col flex-shrink-0">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />

        {/* Screen Content */}
        <div className="flex-1 mt-8 mb-6 mx-3 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center px-3">
          <StepContent
            node={node}
            formName={formName}
            businessLogo={businessLogo}
          />
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-b-[2.5rem] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 w-1/3" />
        </div>
      </div>
    </div>
  );
}

function StepContent({
  node,
  formName,
  businessLogo,
}: {
  node: FlowNode;
  formName: string;
  businessLogo?: string | null;
}) {
  const { products: allProducts } = useStores();
  switch (node.type) {
    case "welcome":
      return (
        <div className="flex flex-col items-center text-center space-y-4 w-full">
          {node.imageUrl ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20">
              <img
                src={node.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : businessLogo ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20">
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-2xl">🪞</span>
            </div>
          )}
          <h2 className="text-white text-xl font-medium leading-tight">
            {node.header || "Welcome!"}
          </h2>
          {node.content && (
            <p className="text-white/70 text-sm">{node.content}</p>
          )}

          {/* Render sections */}
          {node.sections && node.sections.length > 0 && (
            <SectionsPreview sections={node.sections} />
          )}

          {(node.buttonText === undefined || node.buttonText.trim() !== "") && (
            <button className="w-full py-3 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white text-sm hover:bg-white/30 transition-all">
              {node.buttonText || "Get Started"}
            </button>
          )}
        </div>
      );
    case "product-showcase": {
      const ids = node.pinnedProductIds ?? [];

      // Resolve actual product objects from the store
      const previewProducts = ids
        .map((id) => allProducts.find((p) => p.id === id))
        .filter(Boolean)
        .slice(0, 4); // show max 4 in preview

      return (
        <div className="flex flex-col items-center w-full space-y-2">
          {/* Logo */}
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
            {businessLogo ? (
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg">🛍️</span>
            )}
          </div>

          {/* Header */}
          {node.showcaseHeader && (
            <p className="text-white text-xs font-semibold text-center leading-tight px-2">
              {node.showcaseHeader}
            </p>
          )}
          {node.showcaseSubheader && (
            <p className="text-white/60 text-[10px] text-center px-2 line-clamp-2">
              {node.showcaseSubheader}
            </p>
          )}

          {/* Product grid */}
          {ids.length === 0 ? (
            <div className="w-full py-4 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center gap-1">
              <span className="text-lg">🛍️</span>
              <p className="text-white/40 text-[9px] text-center">
                No products selected
              </p>
            </div>
          ) : (
            <div className="w-full grid grid-cols-2 gap-1.5">
              {previewProducts.map((product: any) => (
                <div
                  key={product.id}
                  className="aspect-square rounded-lg overflow-hidden bg-white/10 border border-white/10 relative"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-sm">
                      🛍️
                    </div>
                  )}
                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                    <p className="text-white text-[7px] truncate">
                      {product.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Count badge if more */}
          {ids.length > 4 && (
            <p className="text-white/40 text-[9px]">
              +{ids.length - 4} more products
            </p>
          )}

          <button className="w-full py-2 px-3 bg-white/20 border border-white/30 rounded-xl text-white text-[10px]">
            Continue
          </button>
        </div>
      );
    }

    case "question":
      return (
        <div className="flex flex-col items-center w-full space-y-4">
          {businessLogo ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20">
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-2xl">🪞</span>
            </div>
          )}
          <h2 className="text-white text-lg text-center leading-tight">
            {node.label || "Your question here..."}
          </h2>
          <div className="w-full space-y-2">
            {(node.questionType === "multiple-choice" ||
              node.questionType === "quiz") &&
              node.options?.slice(0, 3).map((option, i) => (
                <div
                  key={i}
                  className="w-full py-2.5 px-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm text-center"
                >
                  {option}
                </div>
              ))}
            {node.questionType === "rating" && (
              <div className="space-y-2">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="w-10 h-10 bg-white/10 border border-white/20 rounded-lg flex items-center justify-center text-white text-sm"
                    >
                      {n}
                    </div>
                  ))}
                </div>
                {(node.ratingScaleLeft || node.ratingScaleRight) && (
                  <div className="flex justify-between text-white/60 text-xs px-1">
                    <span>{node.ratingScaleLeft || ""}</span>
                    <span>{node.ratingScaleRight || ""}</span>
                  </div>
                )}
              </div>
            )}
            {(node.questionType === "short-answer" ||
              node.questionType === "long-answer") && (
              <div className="w-full py-2.5 px-4 bg-white/10 border border-white/20 rounded-xl text-white/50 text-sm">
                Type your answer...
              </div>
            )}
            {node.questionType === "checkboxes" &&
              node.options?.slice(0, 3).map((option, i) => (
                <div
                  key={i}
                  className="w-full py-2.5 px-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm text-center flex items-center gap-2"
                >
                  <div className="w-4 h-4 border border-white/30 rounded" />
                  <span>{option}</span>
                </div>
              ))}
          </div>
        </div>
      );

    case "message":
      return (
        <div className="flex flex-col items-center text-center space-y-3">
          {node.imageUrl ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20">
              <img
                src={node.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : businessLogo ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20">
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
          )}
          {node.header && (
            <h2 className="text-white text-lg font-semibold text-center leading-tight">
              {node.header}
            </h2>
          )}
          {node.subheader && (
            <p className="text-white/70 text-sm text-center leading-relaxed">
              {node.subheader}
            </p>
          )}
          {!node.header && !node.subheader && (
            <p className="text-white/50 text-sm text-center">
              Add a header or subheader...
            </p>
          )}
          {node.linkUrl && node.linkUrl.trim() !== "" && (
            <button className="py-2 px-4 bg-white/80 rounded-xl text-mirour-dark text-sm font-medium">
              {node.linkTitle || "Learn More"}
            </button>
          )}
        </div>
      );

    case "customer-info":
      return (
        <div className="flex flex-col items-center w-full space-y-4">
          {businessLogo ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🪞</span>
            </div>
          )}
          <h2 className="text-white text-lg text-center">
            {node.content || "Almost done! Share your info."}
          </h2>
          <div className="w-full space-y-3">
            {node.captureFields?.name && (
              <div className="w-full py-2.5 px-4 bg-white/10 border border-white/20 rounded-xl text-white/50 text-sm flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Your name</span>
              </div>
            )}
            {node.captureFields?.email && (
              <div className="w-full py-2.5 px-4 bg-white/10 border border-white/20 rounded-xl text-white/50 text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>your@email.com</span>
              </div>
            )}
            {node.captureFields?.phone && (
              <div className="w-full py-2.5 px-4 bg-white/10 border border-white/20 rounded-xl text-white/50 text-sm flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>(555) 123-4567</span>
              </div>
            )}
          </div>
          <button className="w-full py-2.5 px-4 bg-white/20 border border-white/30 rounded-xl text-white text-sm">
            Continue
          </button>
          {!node.contactRequired && (
            <button className="w-full py-2 px-4 text-white/60 text-xs">
              Skip
            </button>
          )}
        </div>
      );

    case "complete":
      return (
        <div className="flex flex-col items-center text-center space-y-4 w-full">
          {businessLogo ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🪞</span>
            </div>
          )}
          <h2 className="text-white text-xl font-medium">
            {node.header || "Thank You!"}
          </h2>
          <p className="text-white/70 text-sm">
            {node.content || "Thanks for helping shape what we do next."}
          </p>

          {/* Render sections */}
          {node.sections && node.sections.length > 0 && (
            <SectionsPreview sections={node.sections} />
          )}

          {node.hasPerk && node.perk && (
            <div className="w-full bg-white/10 border border-white/20 rounded-xl p-4 space-y-3">
              <p className="text-white text-sm">{node.perk}</p>
              {node.perkCode && (
                <div className="bg-white/20 border border-white/30 rounded-lg py-2 px-3">
                  <p className="text-white text-xs tracking-widest font-mono">
                    {node.perkCode}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      );

    case "recommendation":
      return (
        <div className="flex flex-col items-center text-center space-y-4 w-full">
          {businessLogo ? (
            <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
              <img
                src={businessLogo}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">✨</span>
            </div>
          )}
          <h2 className="text-white text-xl font-medium">
            {node.header || "Recommended for You"}
          </h2>
          <p className="text-white/70 text-sm">
            {node.content ||
              "Based on your answers, we think you'll love these:"}
          </p>

          <div className="w-full grid grid-cols-2 gap-2 mt-4">
            {/* Placeholder products for preview */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col">
                <div className="aspect-[3/4] rounded-lg bg-white/10 border border-white/20 mb-2 flex items-center justify-center">
                  <span className="text-2xl">🛍️</span>
                </div>
                <div className="h-2 w-3/4 bg-white/10 rounded mb-1"></div>
                <div className="h-2 w-1/2 bg-white/5 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className="text-white/50 text-sm text-center">
          Preview not available
        </div>
      );
  }
}

// Component to preview sections in the phone frame
function SectionsPreview({ sections }: { sections: WelcomeSection[] }) {
  return (
    <div className="w-full space-y-2">
      {sections.map((section) => {
        switch (section.type) {
          case "content":
            return (
              <div key={section.id} className="w-full">
                {section.imageUrl && (
                  <div className="w-full h-16 rounded-lg overflow-hidden bg-white/10 mb-2">
                    <img
                      src={section.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {section.text && (
                  <p className="text-white/80 text-xs">{section.text}</p>
                )}
              </div>
            );
          case "link":
            const linkUrl = section.linkUrl || "#";
            const formattedUrl =
              linkUrl !== "#" &&
              !linkUrl.startsWith("http://") &&
              !linkUrl.startsWith("https://")
                ? `https://${linkUrl}`
                : linkUrl;
            return (
              <a
                key={section.id}
                href={formattedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-4 bg-white/80 rounded-xl text-mirour-dark text-xs font-medium block text-center"
              >
                {section.linkTitle || "Link"}
              </a>
            );
          case "options":
            return (
              <div key={section.id} className="w-full space-y-1.5">
                {section.options?.slice(0, 3).map((option, i) => (
                  <button
                    key={i}
                    className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white text-xs"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            );
          case "product":
            return (
              <div key={section.id} className="w-full grid grid-cols-2 gap-2">
                {section.products?.slice(0, 4).map((product) => {
                  const formattedUrl =
                    product.linkUrl &&
                    product.linkUrl !== "#" &&
                    !product.linkUrl.startsWith("http://") &&
                    !product.linkUrl.startsWith("https://")
                      ? `https://${product.linkUrl}`
                      : product.linkUrl;

                  const content = (
                    <div className="flex flex-col">
                      <div className="aspect-[3/4] rounded-lg overflow-hidden bg-white/10 border border-white/20">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            <span className="text-lg">📦</span>
                          </div>
                        )}
                      </div>
                      <p className="text-white text-xs mt-1 truncate">
                        {product.name}
                      </p>
                    </div>
                  );

                  return formattedUrl ? (
                    <a
                      key={product.id}
                      href={formattedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:opacity-80 transition-opacity"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={product.id}>{content}</div>
                  );
                })}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
