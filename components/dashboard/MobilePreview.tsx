"use client";

import { useState, useCallback } from 'react';
import { DashboardForm } from '@/types/dashboard';
import { FlowNode, WelcomeSection } from '@/types/mirour';
import { X, ArrowRight, ExternalLink } from 'lucide-react';

type MobilePreviewProps = {
  form: DashboardForm;
  onClose: () => void;
  businessName: string;
  businessLogo: string | null;
};

// Sections Renderer for Welcome/Complete screens - matches CustomerForm
function SectionsRenderer({ 
  sections, 
  onOptionClick 
}: { 
  sections: WelcomeSection[]; 
  onOptionClick: (option: { label: string; targetNodeId?: string }) => void;
}) {
  return (
    <div className="w-full max-w-md space-y-4 mb-6">
      {sections.map((section) => {
        switch (section.type) {
          case 'content':
            return (
              <div key={section.id} className="w-full flex flex-col items-center">
                {section.imageUrl && (
                <div className="w-full aspect-video rounded-2xl overflow-hidden bg-white/10 border border-white/20 mb-3">
                  <img src={section.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                )}
                {section.text && (
                  <p className="text-white/80 text-center">{section.text}</p>
                )}
              </div>
            );
          case 'link':
            const linkUrl = section.linkUrl || '#';
            const formattedUrl = linkUrl !== '#' && !linkUrl.startsWith('http://') && !linkUrl.startsWith('https://') 
              ? `https://${linkUrl}` 
              : linkUrl;
            return (
              <a 
                key={section.id}
                href={formattedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 bg-white/80 backdrop-blur-md rounded-2xl text-mirour-dark font-medium hover:bg-white/90 transition-all shadow-lg flex items-center justify-center"
              >
                {section.linkTitle || 'Learn More'}
              </a>
            );
          case 'options':
            return (
              <div key={section.id} className="w-full space-y-3">
                {section.options?.map((option, i) => (
                  <button 
                    key={i}
                    onClick={() => onOptionClick(option)}
                    className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-lg hover:bg-white/20 transition-all shadow-lg"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            );
          case 'product':
            return (
              <div key={section.id} className="w-full grid grid-cols-2 gap-3">
                {section.products?.map((product) => {
                  const formattedUrl = product.linkUrl && product.linkUrl !== '#' && !product.linkUrl.startsWith('http://') && !product.linkUrl.startsWith('https://')
                    ? `https://${product.linkUrl}`
                    : product.linkUrl;
                  
                  const content = (
                    <div className="flex flex-col">
                      <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-white/10 border border-white/20">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            <span className="text-3xl">📦</span>
                          </div>
                        )}
                      </div>
                      <p className="text-white text-sm mt-2 font-medium">{product.name}</p>
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

// Powered by Mirour footer - used on all screens
function PoweredByFooter() {
  return (
    <div className="mt-4 text-white/40 text-xs text-center">
      Powered by <a href="https://mirourmirour.co" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white/80 transition-colors">Mirour</a>
    </div>
  );
}

export function MobilePreview({ form, onClose, businessName, businessLogo }: MobilePreviewProps) {
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(form.questions[0]?.id || null);
  const [answers, setAnswers] = useState<{ [questionId: string]: any }>({});
  const [quizScore, setQuizScore] = useState(0);
  const [screen, setScreen] = useState<'flow' | 'contact' | 'thankyou'>('flow');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [redemptionCode, setRedemptionCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const currentNode = form.questions.find(n => n.id === currentNodeId) || null;

  // Calculate progress
  const questionNodes = form.questions.filter(n => n.type === 'question');
  const answeredCount = questionNodes.filter(n => answers[n.id] !== undefined).length;
  const progress = questionNodes.length > 0 ? (answeredCount / questionNodes.length) * 100 : 0;

  // Get complete node for score
  const getCompleteNodeForScore = useCallback((): FlowNode | undefined => {
    const scoreResultNodes = form.questions.filter(
      n => n.type === 'complete' && n.isScoreResult && n.scoreThreshold
    );
    
    const matched = scoreResultNodes.find(n => 
      n.scoreThreshold && 
      quizScore >= n.scoreThreshold.min && 
      quizScore <= n.scoreThreshold.max
    );
    
    if (matched) return matched;
    
    return form.questions.find(n => n.type === 'complete' && !n.isScoreResult) 
      || form.questions.find(n => n.type === 'complete');
  }, [form.questions, quizScore]);

  const goToNextNode = useCallback((answer?: any) => {
    if (!currentNode) return;

    // For choice questions, check conditional routing
    if (currentNode.type === 'question' && currentNode.conditionalNext && answer) {
      const conditionalMatch = currentNode.conditionalNext.find(
        c => c.optionValue === answer
      );
      if (conditionalMatch) {
        const targetNode = form.questions.find(n => n.id === conditionalMatch.nextNodeId);
        if (targetNode) {
          setCurrentNodeId(targetNode.id);
          return;
        }
      }
    }

    // Check if there's a default next node
    if (currentNode.nextNodeId) {
      const targetNode = form.questions.find(n => n.id === currentNode.nextNodeId);
      if (targetNode) {
        setCurrentNodeId(targetNode.id);
        return;
      }
    }

    // Fall back to next node in array
    const currentIndex = form.questions.findIndex(n => n.id === currentNodeId);
    if (currentIndex < form.questions.length - 1) {
      const nextNode = form.questions[currentIndex + 1];
      setCurrentNodeId(nextNode.id);
    }
  }, [form.questions, currentNode, currentNodeId]);

  const handleAnswer = useCallback((answer: any) => {
    if (!currentNode) return;
    setAnswers(prev => ({ ...prev, [currentNode.id]: answer }));
    setErrorMessage('');
    
    // Calculate score for quiz questions
    if (currentNode.questionType === 'quiz' && currentNode.options && currentNode.optionScores) {
      const answerIndex = currentNode.options.indexOf(answer);
      if (answerIndex !== -1 && currentNode.optionScores[answerIndex] !== undefined) {
        setQuizScore(prev => prev + currentNode.optionScores![answerIndex]);
      }
    }
    
    setTimeout(() => {
      // Check if this was the last question before complete
      const nextIndex = form.questions.findIndex(n => n.id === currentNodeId);
      const nextNode = nextIndex !== undefined ? form.questions[nextIndex + 1] : null;
      
      if (nextNode?.type === 'complete') {
        // Check if we need contact info
        const customerInfoNode = form.questions.find(n => n.type === 'customer-info');
        if (customerInfoNode) {
          setCurrentNodeId(customerInfoNode.id);
          return;
        }
        // Show thank you directly
        const code = 'MIR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        setRedemptionCode(code);
        setScreen('thankyou');
        return;
      }
      
      goToNextNode(answer);
    }, 300);
  }, [currentNode, form.questions, currentNodeId, goToNextNode]);

  const handleContinue = useCallback(() => {
    goToNextNode();
  }, [goToNextNode]);

  const handleSectionOptionClick = (option: { label: string; targetNodeId?: string }) => {
    if (option.targetNodeId) {
      const targetNode = form.questions.find(n => n.id === option.targetNodeId);
      if (targetNode) {
        setCurrentNodeId(targetNode.id);
        return;
      }
    }
    handleContinue();
  };

  const handleContactSubmit = () => {
    const customerInfoNode = form.questions.find(n => n.type === 'customer-info');
    const isContactRequired = customerInfoNode?.contactRequired ?? false;

    if (isContactRequired) {
      if (form.captureName && !customerName.trim()) {
        setErrorMessage('Please enter your name');
        return;
      }
      if (form.captureEmail && !customerEmail.trim()) {
        setErrorMessage('Please enter your email');
        return;
      }
      if (form.capturePhone && !customerPhone.trim()) {
        setErrorMessage('Please enter your phone number');
        return;
      }
    }

    const code = 'MIR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setRedemptionCode(code);
    setScreen('thankyou');
  };

  // Contact Information Screen
  if (screen === 'contact') {
    return (
      <div className="fixed inset-0 z-50 bg-mirour-dark animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-24 overflow-y-auto">
          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0">
            {businessLogo ? (
              <img src={businessLogo} alt={businessName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">🪞</span>
            )}
          </div>

          <h2 className="text-white text-2xl text-center mb-6 px-4 leading-tight">
            Finish to get your reward!
          </h2>

          <div className="w-full max-w-md space-y-4 mb-6">
            {form.captureName && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {form.captureEmail && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {form.capturePhone && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">Phone</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
          )}

          <button
            onClick={handleContactSubmit}
            className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
          >
            Continue
          </button>

          {!form.questions.find(n => n.type === 'customer-info')?.contactRequired && (
            <button
              onClick={() => {
                const code = 'MIR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                setRedemptionCode(code);
                setScreen('thankyou');
              }}
              className="w-full max-w-md py-3 px-6 bg-transparent text-white/60 hover:text-white/80 transition-all text-sm"
            >
              Skip
            </button>
          )}

          <PoweredByFooter />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-primary to-mirour-yellow w-full" />
        </div>
      </div>
    );
  }

  // Thank You Screen
  if (screen === 'thankyou') {
    const completeNode = getCompleteNodeForScore();
    const hasPerk = completeNode?.hasPerk && completeNode?.perk;
    const perkText = completeNode?.perk || form.perk;
    
    return (
      <div className="fixed inset-0 z-50 bg-mirour-dark animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-24 overflow-y-auto">
          {businessLogo ? (
            <div className="w-28 h-28 rounded-full overflow-hidden bg-white/10 border border-white/20 mb-6 flex items-center justify-center flex-shrink-0">
              <img src={businessLogo} alt={businessName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-28 h-28 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-6 flex-shrink-0">
              <span className="text-3xl">🪞</span>
            </div>
          )}

          <h2 className="text-white text-3xl text-center mb-2 px-4">
            {completeNode?.header || 'Thank You!'}
          </h2>
          <p className="text-white/70 text-center mb-6 px-4">
            {completeNode?.content || 'Thanks for helping shape what we do next.'}
          </p>

          {/* Render custom sections from complete node */}
          {completeNode?.sections && completeNode.sections.length > 0 && (
            <SectionsRenderer 
              sections={completeNode.sections} 
              onOptionClick={() => {}}
            />
          )}

          {hasPerk && (
            <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-4 mb-4">
              <p className="text-xl text-white text-center">
                {perkText}
              </p>

              {completeNode?.perkCode && (
                <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-4">
                  <p className="text-2xl tracking-widest text-white text-center font-mono">
                    {completeNode.perkCode}
                  </p>
                </div>
              )}
            </div>
          )}

          <PoweredByFooter />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-primary to-mirour-yellow w-full" />
        </div>
      </div>
    );
  }

  // Welcome Screen
  if (currentNode?.type === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 bg-mirour-dark animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-12 overflow-y-auto">
          <p className="text-white text-xl font-medium mb-4 text-center">{businessName}</p>
          
          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            {currentNode.imageUrl ? (
              <img src={currentNode.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : businessLogo ? (
              <img src={businessLogo} alt={businessName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">🪞</span>
            )}
          </div>

          <h2 className="text-white text-3xl text-center mb-2 px-4 leading-tight">
            {currentNode.header || 'Welcome!'}
          </h2>
          
          {currentNode.content && (
            <p className="text-white/70 text-center mb-6 px-4">
              {currentNode.content}
            </p>
          )}

          {/* Render custom sections */}
          {currentNode.sections && currentNode.sections.length > 0 && (
            <SectionsRenderer 
              sections={currentNode.sections} 
              onOptionClick={handleSectionOptionClick}
            />
          )}

          {(currentNode.buttonText === undefined || currentNode.buttonText.trim() !== '') && (
            <button
              onClick={handleContinue}
              className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {currentNode.buttonText || 'Get Started'}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}

          <PoweredByFooter />
        </div>
      </div>
    );
  }

  // Message Screen
  if (currentNode?.type === 'message') {
    return (
      <div className="fixed inset-0 z-50 bg-mirour-dark animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-12 overflow-y-auto">
          <p className="text-white text-xl font-medium mb-4 text-center">{businessName}</p>
          
          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            {currentNode.imageUrl ? (
              <img src={currentNode.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : businessLogo ? (
              <img src={businessLogo} alt={businessName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">💬</span>
            )}
          </div>

          {currentNode.header && (
            <h2 className="text-white text-2xl font-semibold text-center mb-2 px-4">
              {currentNode.header}
            </h2>
          )}
          {currentNode.subheader && (
            <p className="text-white/80 text-base text-center mb-6 px-4 leading-relaxed">
              {currentNode.subheader}
            </p>
          )}
          {!currentNode.header && !currentNode.subheader && (
            <p className="text-white/60 text-base text-center mb-6 px-4">
              Content card
            </p>
          )}

          {/* External link button if available */}
          {currentNode.linkUrl && currentNode.linkUrl.trim() !== '' && (
            <a
              href={currentNode.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full max-w-md py-4 px-6 mb-4 bg-white/80 backdrop-blur-md rounded-2xl text-mirour-dark font-medium hover:bg-white/90 transition-all shadow-lg flex items-center justify-center"
            >
              {currentNode.linkTitle || 'Learn More'}
            </a>
          )}

          <button
            onClick={handleContinue}
            className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
          >
            Continue
          </button>

          <PoweredByFooter />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div 
            className="h-full bg-gradient-to-r from-primary to-mirour-yellow transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Customer Info Screen (node-based)
  if (currentNode?.type === 'customer-info') {
    const captureFields = currentNode.captureFields || { name: false, email: false, phone: false };
    
    const handleCustomerInfoSubmit = () => {
      const isRequired = currentNode.contactRequired ?? false;
      
      if (isRequired) {
        if (captureFields.name && !customerName.trim()) {
          setErrorMessage('Please enter your name');
          return;
        }
        if (captureFields.email && !customerEmail.trim()) {
          setErrorMessage('Please enter your email');
          return;
        }
        if (captureFields.phone && !customerPhone.trim()) {
          setErrorMessage('Please enter your phone number');
          return;
        }
      }
      setErrorMessage('');
      
      // Move to next node (likely complete)
      const code = 'MIR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setRedemptionCode(code);
      setScreen('thankyou');
    };
    
    return (
      <div className="fixed inset-0 z-50 bg-mirour-dark animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative w-full h-full flex flex-col items-center justify-center px-6 pt-8 pb-24 overflow-y-auto">
          <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0">
            {businessLogo ? (
              <img src={businessLogo} alt={businessName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">🪞</span>
            )}
          </div>

          <h2 className="text-white text-2xl text-center mb-6 px-4 leading-tight">
            {currentNode.content || 'Almost done! Share your info.'}
          </h2>

          <div className="w-full max-w-md space-y-4 mb-6">
            {captureFields.name && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {captureFields.email && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}

            {captureFields.phone && (
              <div>
                <label className="block text-white/80 text-sm mb-2 px-2">Phone</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                />
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-red-400 text-sm mb-4">{errorMessage}</p>
          )}

          <button
            onClick={handleCustomerInfoSubmit}
            className="w-full max-w-md py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
          >
            Continue
          </button>

          {!currentNode.contactRequired && (
            <button
              onClick={() => {
                const code = 'MIR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                setRedemptionCode(code);
                setScreen('thankyou');
              }}
              className="w-full max-w-md py-3 px-6 bg-transparent text-white/60 hover:text-white/80 transition-all text-sm"
            >
              Skip
            </button>
          )}

          <PoweredByFooter />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-gradient-to-r from-primary to-mirour-yellow w-full" />
        </div>
      </div>
    );
  }

  // Question Screen
  if (currentNode?.type === 'question') {
    return (
      <div className="fixed inset-0 z-50 bg-mirour-dark animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[60] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="relative w-full h-full flex flex-col items-center pt-8 pb-12 px-6 overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md py-8">
            <p className="text-white text-xl font-medium mb-4 text-center flex-shrink-0">{businessName}</p>
            
            <div className="w-28 h-28 mb-6 rounded-full overflow-hidden shadow-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center flex-shrink-0">
              {businessLogo ? (
                <img src={businessLogo} alt={businessName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl">🪞</span>
              )}
            </div>

            <h2 className="text-white text-2xl text-center mb-6 px-4 leading-tight flex-shrink-0">
              {currentNode.label}
            </h2>

            <div className="w-full space-y-3 flex-shrink-0">
              {(currentNode.questionType === 'multiple-choice' || currentNode.questionType === 'quiz') && currentNode.options?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-lg hover:bg-white/20 transition-all shadow-lg"
                >
                  {option}
                </button>
              ))}

              {currentNode.questionType === 'rating' && (
                <div className="space-y-3">
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleAnswer(rating)}
                        className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white text-xl hover:bg-white/20 transition-all shadow-lg"
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                  {(currentNode.ratingScaleLeft || currentNode.ratingScaleRight) && (
                    <div className="flex justify-between text-white/60 text-sm px-2">
                      <span>{currentNode.ratingScaleLeft || ''}</span>
                      <span>{currentNode.ratingScaleRight || ''}</span>
                    </div>
                  )}
                </div>
              )}

              {(currentNode.questionType === 'short-answer' || currentNode.questionType === 'long-answer') && (
                <div className="space-y-3">
                  {currentNode.questionType === 'long-answer' ? (
                    <textarea
                      placeholder="Type your answer..."
                      rows={4}
                      className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15 resize-none"
                      onChange={(e) => setAnswers({ ...answers, [currentNode.id]: e.target.value })}
                      value={answers[currentNode.id] || ''}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      className="w-full py-4 px-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none focus:bg-white/15"
                      onChange={(e) => setAnswers({ ...answers, [currentNode.id]: e.target.value })}
                      value={answers[currentNode.id] || ''}
                    />
                  )}
                  <button
                    onClick={() => {
                      const isAnswered = answers[currentNode.id]?.trim();
                      
                      if (!isAnswered) {
                        setErrorMessage('Please answer this question first');
                        setTimeout(() => setErrorMessage(''), 2000);
                        return;
                      }

                      handleAnswer(answers[currentNode.id]);
                    }}
                    className="w-full py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
                  >
                    Next
                  </button>
                </div>
              )}

              {currentNode.questionType === 'checkboxes' && currentNode.options?.map((option, index) => {
                const selected = Array.isArray(answers[currentNode.id]) && answers[currentNode.id].includes(option);
                return (
                  <button
                    key={index}
                    onClick={() => {
                      const currentAnswers = Array.isArray(answers[currentNode.id]) ? answers[currentNode.id] : [];
                      const newAnswers = selected
                        ? currentAnswers.filter((a: string) => a !== option)
                        : [...currentAnswers, option];
                      setAnswers({ ...answers, [currentNode.id]: newAnswers });
                    }}
                    className={`w-full py-4 px-6 backdrop-blur-md border rounded-2xl text-white text-lg transition-all shadow-lg ${
                      selected 
                        ? 'bg-white/30 border-white/50' 
                        : 'bg-white/10 border-white/20 hover:bg-white/20'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {currentNode.questionType === 'checkboxes' && Array.isArray(answers[currentNode.id]) && answers[currentNode.id].length > 0 && (
              <button
                onClick={() => handleAnswer(answers[currentNode.id])}
                className="mt-4 w-full py-4 px-6 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl text-white hover:bg-white/30 transition-all shadow-lg"
              >
                Next
              </button>
            )}

            {errorMessage && (
              <p className="text-red-400 text-sm mt-4 animate-fade-in">{errorMessage}</p>
            )}
          </div>

          <div className="w-full max-w-md flex-shrink-0 mt-4">
            <p className="text-white/40 text-xs text-center mb-3">
              {answeredCount + 1} of {questionNodes.length}
            </p>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-mirour-yellow transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <PoweredByFooter />
          </div>
        </div>
      </div>
    );
  }

  // Complete Screen (auto-transition to thank you)
  if (currentNode?.type === 'complete') {
    if (!redemptionCode) {
      const code = 'MIR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setRedemptionCode(code);
      setScreen('thankyou');
    }
    
    return (
      <div className="fixed inset-0 z-50 bg-mirour-dark flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Fallback
  return (
    <div className="fixed inset-0 z-50 bg-mirour-dark flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[60] w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );
}
