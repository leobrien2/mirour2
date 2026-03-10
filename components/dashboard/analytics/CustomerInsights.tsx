"use client";

import { ShoppingBag, Star, Package, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CustomerInsightsProps {
  insights: {
    topAnswers: { label: string; count: number; percentage: number }[];
    sentiment: { label: string; value: number }[];
    recommendations: string[];
  };
}

export function CustomerInsights({ insights }: CustomerInsightsProps) {
  return (
    <div className="bg-card/50 backdrop-blur-xl rounded-3xl p-6 border-2 border-primary/10 shadow-xl shadow-primary/5 h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-heading text-primary">Customer Insights</h3>
          <p className="text-sm text-muted-foreground">Deep dive into visitor preferences</p>
        </div>
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
          <Star className="w-5 h-5 text-primary" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Top Answers */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Package className="w-4 h-4" />
            Top Preferences
          </h4>
          <div className="space-y-4">
            {insights.topAnswers.map((answer, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{answer.label}</span>
                  <span className="text-primary font-bold">{answer.count}</span>
                </div>
                <Progress value={answer.percentage} className="h-1.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Sentiment */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Star className="w-4 h-4" />
            Vibe Analysis
          </h4>
          <div className="space-y-4">
            {insights.sentiment.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-20 text-xs text-muted-foreground">{item.label}</div>
                <div className="flex-1">
                  <Progress value={item.value} className="h-1.5" />
                </div>
                <div className="w-8 text-xs font-bold text-right">{item.value}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            AI Advice
          </h4>
          <div className="space-y-3">
            {insights.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {i + 1}
                </div>
                <p className="text-xs text-foreground leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="w-full mt-8 py-4 px-6 rounded-2xl bg-secondary border-2 border-primary/20 text-foreground font-heading hover:bg-primary/10 transition-all flex items-center justify-center gap-2 group">
        Download Full Report
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
