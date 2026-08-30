// src/components/SohCurveChart.tsx
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';

interface SohCurveChartProps {
  cycles: number[];
  capacityBaselineMlp: number[];
  capacityPinn: number[]; // represents Physics-LSTM SOH
}

export const SohCurveChart: React.FC<SohCurveChartProps> = ({
  cycles,
  capacityBaselineMlp,
  capacityPinn,
}) => {
  // Map capacity arrays to SOH by dividing by the initial capacity (first element)
  const chartData = useMemo(() => {
    if (!cycles || cycles.length === 0) return [];
    
    // SOH is capacity relative to initial rated capacity
    const initialBaseline = capacityBaselineMlp[0] || 1.1;
    const initialPinn = capacityPinn[0] || 1.1;
    
    return cycles.map((cycle, i) => {
      const sohBaseline = (capacityBaselineMlp[i] ?? initialBaseline) / initialBaseline;
      const sohPinn = (capacityPinn[i] ?? initialPinn) / initialPinn;
      
      return {
        cycle,
        baselineMlp: parseFloat(sohBaseline.toFixed(4)),
        physicsLstm: parseFloat(sohPinn.toFixed(4)),
      };
    });
  }, [cycles, capacityBaselineMlp, capacityPinn]);

  return (
    <div className="p-6 rounded-[24px] bg-slate-900/60 backdrop-blur-xl border border-white/30 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-space font-bold uppercase tracking-wider text-white">
          SOH Degradation Curves
        </h4>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400"></span>
            <span className="text-slate-400">Baseline MLP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#0066FF]"></span>
            <span className="text-[#0066FF]">Physics-LSTM</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="cycle" 
              stroke="rgba(255,255,255,0.4)" 
              fontSize={10} 
              tickLine={false} 
            />
            <YAxis 
              domain={[0.7, 1.0]} 
              stroke="rgba(255,255,255,0.4)" 
              fontSize={10} 
              tickLine={false} 
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '11px',
                fontFamily: 'monospace'
              }} 
            />
            
            {/* Reference Line for EOL Threshold */}
            <ReferenceLine 
              y={0.80} 
              stroke="#EF4444" 
              strokeDasharray="4 4" 
              label={{ 
                value: 'EOL Threshold', 
                fill: '#EF4444', 
                position: 'top',
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: 'bold'
              }} 
            />

            {/* Baseline MLP: dashed, color #94a3b8 */}
            <Line
              type="monotone"
              dataKey="baselineMlp"
              name="Baseline SOH"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={1500}
            />

            {/* Physics-LSTM: solid, color #0066FF */}
            <Line
              type="monotone"
              dataKey="physicsLstm"
              name="Physics-LSTM SOH"
              stroke="#0066FF"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
