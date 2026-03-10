"use client";

import { QrCode, CheckCircle, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: {
    value: number;
    isUp: boolean;
  };
  delay?: string;
}

const MetricCard = ({ title, value, icon: Icon, trend, delay }: MetricCardProps) => (
  <div className={`bg-card/50 backdrop-blur-xl rounded-3xl p-6 border-2 border-primary/10 shadow-xl shadow-primary/5 hover:border-primary/30 transition-all duration-300 group animate-scale-in ${delay}`}>
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      {trend && (
        <Badge 
          variant={trend.isUp ? "default" : "destructive"} 
          className="flex items-center gap-1 py-1 rounded-full bg-opacity-10"
        >
          {trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend.value}%
        </Badge>
      )}
    </div>
    <div>
      <p className="text-muted-foreground text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-heading text-primary tracking-tight">{value}</h3>
    </div>
  </div>
);

interface MetricsGridProps {
  metrics: {
    totalScans: number;
    totalCompleted: number;
    totalProfiles: number;
    captureRate: number;
  };
  loading: boolean;
}

export function MetricsGrid({ metrics, loading }: MetricsGridProps) {
  const displayMetrics = [
    {
      title: "Entry Scans",
      value: metrics.totalScans,
      icon: QrCode,
      delay: "stagger-1",
      trend: { value: 12, isUp: true } // Placeholder trend
    },
    {
      title: "Flow Completions",
      value: metrics.totalCompleted,
      icon: CheckCircle,
      delay: "stagger-2",
      trend: { value: 8, isUp: true }
    },
    {
      title: "Identity Captures",
      value: metrics.totalProfiles,
      icon: Users,
      delay: "stagger-3",
      trend: { value: 5, isUp: true }
    },
    {
      title: "Capture Rate",
      value: `${metrics.captureRate.toFixed(1)}%`,
      icon: TrendingUp,
      delay: "stagger-4",
      trend: { value: 2, isUp: true }
    }
  ];

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {displayMetrics.map((metric, index) => (
        <MetricCard
          key={index}
          title={metric.title}
          value={loading ? "..." : metric.value}
          icon={metric.icon}
          trend={metric.trend}
          delay={metric.delay}
        />
      ))}
    </div>
  );
}
