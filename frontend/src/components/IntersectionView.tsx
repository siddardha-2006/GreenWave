import React from 'react';
import { SimulationMetrics } from '../types';

interface IntersectionViewProps {
  metrics: SimulationMetrics | null;
  phaseType: string;
  timeInPhase: number;
  fallbackEngaged: boolean;
  rejectionReason?: string;
}

export const IntersectionView: React.FC<IntersectionViewProps> = ({
  metrics,
  phaseType,
  timeInPhase,
  fallbackEngaged,
  rejectionReason,
}) => {
  const signalColors = metrics?.signal_colors || {};
  const queues = metrics?.queue_lengths || {};

  const getColorClass = (mId: string) => {
    const c = signalColors[mId] || 'red';
    if (c === 'green') return 'bg-[#2eb872] shadow-[0_0_10px_rgba(46,184,114,0.8)] border-[#4ade80]';
    if (c === 'yellow') return 'bg-[#d99b26] shadow-[0_0_10px_rgba(217,155,38,0.8)] border-[#facc15] animate-pulse';
    return 'bg-[#cf4338]/80 border-[#85231c] shadow-[0_0_6px_rgba(207,67,56,0.5)]';
  };

  const getQueueCount = (mId: string) => queues[mId] || 0;

  return (
    <div className="embossed-plate rounded-sm p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col gap-4">
      {/* Corner Crop Marks */}
      <span className="absolute top-2 left-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌜</span>
      <span className="absolute top-2 right-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌝</span>

      {/* Header status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#2b2824]">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8a8070]">2D Technical Schematic</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full bg-[#2eb872] animate-ping"></span>
            <span className="text-sm font-serif font-medium text-[#f5f2eb] uppercase tracking-wider text-embossed">
              {phaseType.replace('_', ' ')}
            </span>
            <span className="text-[10px] font-mono text-[#a39886]">({timeInPhase.toFixed(1)}s elapsed)</span>
          </div>
        </div>

        {fallbackEngaged && (
          <div className="bg-[#291312] border border-[#cf4338] text-[#f5f2eb] text-[10px] font-mono px-3 py-1 rounded-sm flex items-center gap-1.5 animate-pulse">
            <span>⚠️ Safety Interception: Safe Fallback Active</span>
            {rejectionReason && <span className="text-[#cf4338] text-[9px]">({rejectionReason})</span>}
          </div>
        )}

        <div className="flex items-center gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 bg-[#141311] px-2.5 py-1 rounded-sm border border-[#2b2824]">
            <span className="text-[#736b5e] uppercase">Pedestrian:</span>
            <span className={`font-semibold tracking-wider ${
              metrics?.pedestrian_state === 'walk' ? 'text-[#2eb872]' :
              metrics?.pedestrian_state === 'clearance' ? 'text-[#d99b26] animate-pulse' :
              metrics?.pedestrian_state === 'waiting' ? 'text-[#b0b7c0]' :
              'text-[#5c5448]'
            }`}>
              {metrics?.pedestrian_state?.toUpperCase() || 'IDLE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#141311] px-2.5 py-1 rounded-sm border border-[#2b2824]">
            <span className="text-[#736b5e] uppercase">Emergency:</span>
            <span className={`font-semibold tracking-wider ${
              metrics?.emergency_state === 'active' || metrics?.emergency_state === 'preempting'
                ? 'text-[#cf4338] animate-bounce'
                : metrics?.emergency_state === 'approaching'
                ? 'text-[#d99b26]'
                : 'text-[#5c5448]'
            }`}>
              {metrics?.emergency_state?.toUpperCase() || 'NONE'}
            </span>
          </div>
        </div>
      </div>

      {/* 4-Way Junction Schematic SVG / Layout */}
      <div className="relative w-full aspect-square max-w-[480px] mx-auto debossed-well rounded-sm overflow-hidden flex items-center justify-center p-4">
        {/* Road canvas lines */}
        <div className="absolute inset-x-0 h-36 bg-[#161513] top-1/2 -translate-y-1/2 border-y border-dashed border-[#38342e]"></div>
        <div className="absolute inset-y-0 w-36 bg-[#161513] left-1/2 -translate-x-1/2 border-x border-dashed border-[#38342e]"></div>
        <div className="absolute w-36 h-36 bg-[#1d1b18] border border-[#38342e] rounded-sm shadow-inner"></div>

        {/* --- NORTH APPROACH (Incoming from Top) --- */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="text-[9px] font-mono font-bold text-[#c99a5b] uppercase tracking-[0.2em] mb-1">North Approach</div>
          <div className="flex gap-2 bg-[#12110f] p-1.5 rounded-sm border border-[#2b2824] shadow-md">
            {/* M2 Right */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-[#736b5e]">M2 (R)</span>
              <div className={`w-3.5 h-3.5 rounded-full border ${getColorClass('M2')}`}></div>
              <span className="text-[9px] font-mono text-[#c99a5b] mt-0.5">{getQueueCount('M2')}q</span>
            </div>
            {/* M0 Through */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-[#f5f2eb] font-bold">M0 (T)</span>
              <div className={`w-4 h-4 rounded-full border ${getColorClass('M0')}`}></div>
              <span className="text-[9px] font-mono text-[#c99a5b] mt-0.5">{getQueueCount('M0')}q</span>
            </div>
            {/* M1 Left */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-[#736b5e]">M1 (L)</span>
              <div className={`w-3.5 h-3.5 rounded-full border ${getColorClass('M1')}`}></div>
              <span className="text-[9px] font-mono text-[#c99a5b] mt-0.5">{getQueueCount('M1')}q</span>
            </div>
          </div>
        </div>

        {/* --- SOUTH APPROACH (Incoming from Bottom) --- */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="flex gap-2 bg-[#12110f] p-1.5 rounded-sm border border-[#2b2824] mb-1 shadow-md">
            {/* M5 Left */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-[#736b5e]">M5 (L)</span>
              <div className={`w-3.5 h-3.5 rounded-full border ${getColorClass('M5')}`}></div>
              <span className="text-[9px] font-mono text-[#c99a5b] mt-0.5">{getQueueCount('M5')}q</span>
            </div>
            {/* M3 Through */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-[#f5f2eb] font-bold">M3 (T)</span>
              <div className={`w-4 h-4 rounded-full border ${getColorClass('M3')}`}></div>
              <span className="text-[9px] font-mono text-[#c99a5b] mt-0.5">{getQueueCount('M3')}q</span>
            </div>
            {/* M4 Right */}
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-[#736b5e]">M4 (R)</span>
              <div className={`w-3.5 h-3.5 rounded-full border ${getColorClass('M4')}`}></div>
              <span className="text-[9px] font-mono text-[#c99a5b] mt-0.5">{getQueueCount('M4')}q</span>
            </div>
          </div>
          <div className="text-[9px] font-mono font-bold text-[#c99a5b] uppercase tracking-[0.2em]">South Approach</div>
        </div>

        {/* --- WEST APPROACH (Incoming from Left) --- */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="text-[9px] font-mono font-bold text-[#c99a5b] uppercase tracking-[0.2em] mb-1">West</div>
          <div className="flex flex-col gap-1.5 bg-[#12110f] p-1.5 rounded-sm border border-[#2b2824] shadow-md">
            {/* M10 Left */}
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[9px] text-slate-400">M10 (L)</span>
              <div className={`w-3 h-3 rounded-full border ${getColorClass('M10')}`}></div>
              <span className="text-[9px] font-mono text-amber-300">{getQueueCount('M10')}</span>
            </div>
            {/* M9 Through */}
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[9px] text-slate-400 font-bold">M9 (T)</span>
              <div className={`w-3.5 h-3.5 rounded-full border ${getColorClass('M9')}`}></div>
              <span className="text-[9px] font-mono text-amber-300">{getQueueCount('M9')}</span>
            </div>
            {/* M11 Right */}
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[9px] text-slate-400">M11 (R)</span>
              <div className={`w-3 h-3 rounded-full border ${getColorClass('M11')}`}></div>
              <span className="text-[9px] font-mono text-amber-300">{getQueueCount('M11')}</span>
            </div>
          </div>
        </div>

        {/* --- EAST APPROACH (Incoming from Right) --- */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="text-[9px] font-mono font-bold text-[#c99a5b] uppercase tracking-[0.2em] mb-1">East</div>
          <div className="flex flex-col gap-1.5 bg-[#12110f] p-1.5 rounded-sm border border-[#2b2824] shadow-md">
            {/* M7 Right */}
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[9px] font-mono text-amber-300">{getQueueCount('M7')}</span>
              <div className={`w-3 h-3 rounded-full border ${getColorClass('M7')}`}></div>
              <span className="text-[9px] text-slate-400">M7 (R)</span>
            </div>
            {/* M6 Through */}
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[9px] font-mono text-amber-300">{getQueueCount('M6')}</span>
              <div className={`w-3.5 h-3.5 rounded-full border ${getColorClass('M6')}`}></div>
              <span className="text-[9px] text-slate-400 font-bold">M6 (T)</span>
            </div>
            {/* M8 Left */}
            <div className="flex items-center gap-1.5 justify-between">
              <span className="text-[9px] font-mono text-amber-300">{getQueueCount('M8')}</span>
              <div className={`w-3 h-3 rounded-full border ${getColorClass('M8')}`}></div>
              <span className="text-[9px] text-slate-400">M8 (L)</span>
            </div>
          </div>
        </div>

        {/* Center Intersection Hub */}
        <div className="z-10 text-center pointer-events-none bg-[#12110f]/90 px-3 py-1.5 rounded-sm border border-[#2b2824] shadow-lg">
          <div className="text-sm font-serif font-bold text-[#c99a5b]">GW</div>
          <div className="text-[10px] font-mono text-[#e8e1d5] font-semibold mt-0.5">
            {metrics ? `${metrics.simulation_time}s` : '0.0s'}
          </div>
          <div className="text-[8px] font-mono tracking-widest text-[#736b5e] uppercase">SUMO SIM</div>
        </div>
      </div>
    </div>
  );
};

