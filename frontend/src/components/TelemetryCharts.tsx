import React from 'react';
import { SimulationMetrics } from '../types';

interface TelemetryChartsProps {
  metrics: SimulationMetrics | null;
  history: SimulationMetrics[];
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ metrics, history }) => {
  const queueMap = metrics?.queue_lengths || {};
  const currentTotalQueue = Object.values(queueMap).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);

  return (
    <div className="embossed-plate rounded-sm p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative">
      {/* Corner Crop Marks */}
      <span className="absolute top-2 left-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌜</span>
      <span className="absolute top-2 right-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌝</span>

      <div className="flex flex-wrap items-center justify-between border-b border-[#2b2824] pb-3.5 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#c99a5b] text-xs font-mono">02 //</span>
            <h3 className="text-sm font-serif font-medium text-[#f5f2eb] uppercase tracking-[0.22em] text-embossed">
              Live Intersection Telemetry & Demands
            </h3>
          </div>
          <p className="text-[10px] font-mono tracking-wider text-[#8a8070] mt-0.5 uppercase">
            Dynamically Registered Delay, Queue Densities & Evacuation Flow
          </p>
        </div>
        <span className="text-[9px] bg-[#161513] text-[#a39886] border border-[#2b2824] px-2.5 py-1 rounded-sm font-mono tracking-widest uppercase">
          TICKS: {history.length.toString().padStart(4, '0')}
        </span>
      </div>

      {/* KPI Cards / Pressed Letterpress Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="debossed-well p-3 rounded-sm relative">
          <div className="text-[9px] text-[#8a8070] uppercase font-mono tracking-widest">Mean Wait</div>
          <div className="text-xl font-bold font-mono text-[#d99b26] mt-1 text-embossed">
            {typeof metrics?.mean_waiting_time === 'number' ? `${metrics.mean_waiting_time.toFixed(1)}s` : '0.0s'}
          </div>
          <div className="text-[9px] font-mono text-[#5c5448] mt-1 tracking-wider">
            PEAK: {typeof metrics?.max_waiting_time === 'number' ? `${metrics.max_waiting_time.toFixed(1)}s` : '0.0s'}
          </div>
        </div>

        <div className="debossed-well p-3 rounded-sm relative">
          <div className="text-[9px] text-[#8a8070] uppercase font-mono tracking-widest">Total Queue</div>
          <div className="text-xl font-bold font-mono text-[#b0b7c0] mt-1 text-embossed">
            {currentTotalQueue} <span className="text-xs font-normal text-[#736b5e]">VEH</span>
          </div>
          <div className="text-[9px] font-mono text-[#5c5448] mt-1 tracking-wider">Across 12 corridors</div>
        </div>

        <div className="debossed-well p-3 rounded-sm relative">
          <div className="text-[9px] text-[#8a8070] uppercase font-mono tracking-widest">Throughput</div>
          <div className="text-xl font-bold font-mono text-[#2eb872] mt-1 text-embossed">
            {typeof metrics?.throughput === 'number' ? metrics.throughput : 0} <span className="text-xs font-normal text-[#736b5e]">FLOW</span>
          </div>
          <div className="text-[9px] font-mono text-[#5c5448] mt-1 tracking-wider">Cumulative cleared</div>
        </div>

        <div className="debossed-well p-3 rounded-sm relative">
          <div className="text-[9px] text-[#8a8070] uppercase font-mono tracking-widest">Priority Delay</div>
          <div className="text-xl font-bold font-mono text-[#cf4338] mt-1 text-embossed">
            {typeof metrics?.emergency_delay === 'number' ? `${metrics.emergency_delay.toFixed(1)}s` : '0.0s'}
          </div>
          <div className="text-[9px] font-mono text-[#5c5448] mt-1 tracking-wider">Preemption clearance</div>
        </div>
      </div>

      {/* Movement Queue Bars */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-[#a39886] uppercase tracking-[0.2em] mb-2.5">
          <span>Corridor Demands [M00 – M11]</span>
          <span className="text-[#5c5448]">ACTIVE SIGNAL STATUS</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {Object.entries(queueMap).map(([mId, q]) => {
            const color = metrics?.signal_colors?.[mId] || 'red';
            const numQ = typeof q === 'number' ? q : 0;
            return (
              <div key={mId} className="bg-[#141311] border border-[#262420] p-2 rounded-sm flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-[#e8e1d5] tracking-wider">{mId}</span>
                  <span className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    color === 'green' ? 'bg-[#2eb872] shadow-[0_0_8px_rgba(46,184,114,0.8)]' :
                    color === 'yellow' ? 'bg-[#d99b26] shadow-[0_0_8px_rgba(217,155,38,0.8)]' : 'bg-[#cf4338] shadow-[0_0_6px_rgba(207,67,56,0.6)]'
                  }`}></span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-1.5">
                  <div className="w-full debossed-well h-1.5 rounded-sm overflow-hidden p-[1px]">
                    <div
                      className="bg-gradient-to-r from-[#c99a5b] to-[#e8e1d5] h-full rounded-sm transition-all duration-300"
                      style={{ width: `${Math.min(numQ * 10, 100)}%` }}
                    ></div>
                  </div>
                  <span className="font-mono text-xs text-[#c99a5b] font-semibold">{numQ}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
