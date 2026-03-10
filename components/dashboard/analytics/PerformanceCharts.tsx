"use client";

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from "recharts";

interface PerformanceChartsProps {
  trafficData: any[]; // Daily stats
  funnelData: any[]; // Funnel steps
}

export function PerformanceCharts({ trafficData, funnelData }: PerformanceChartsProps) {
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      {/* Traffic Trends */}
      <div className="bg-card/50 backdrop-blur-xl rounded-3xl p-6 border-2 border-primary/10 shadow-xl shadow-primary/5">
        <h3 className="text-xl font-heading text-primary mb-6">Traffic Trends</h3>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.1} vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--primary) / 0.2)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="scans" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorScans)" 
              />
              <Area 
                type="monotone" 
                dataKey="completions" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={3}
                fillOpacity={0}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-card/50 backdrop-blur-xl rounded-3xl p-6 border-2 border-primary/10 shadow-xl shadow-primary/5">
        <h3 className="text-xl font-heading text-primary mb-6">Conversion Funnel</h3>
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  borderColor: 'hsl(var(--primary) / 0.2)',
                  borderRadius: '16px'
                }}
              />
              <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40}>
                {funnelData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? 'hsl(var(--primary))' : index === 1 ? 'hsl(var(--primary) / 0.7)' : 'hsl(var(--primary) / 0.4)'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
