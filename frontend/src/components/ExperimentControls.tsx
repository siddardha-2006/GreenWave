import React, { useState } from 'react';
import { Experiment, ScenarioInfo } from '../types';

interface ExperimentControlsProps {
  scenarios: ScenarioInfo[];
  activeExperiment: Experiment | null;
  isRunning: boolean;
  isEmergencyActive?: boolean;
  onStart: (config: any) => void;
  onStop: () => void;
  onInjectPedestrian: (approach: string) => void;
  onInjectEmergency: (movement: string) => void;
}

export const ExperimentControls: React.FC<ExperimentControlsProps> = ({
  scenarios,
  activeExperiment,
  isRunning,
  isEmergencyActive = false,
  onStart,
  onStop,
  onInjectPedestrian,
  onInjectEmergency,
}) => {
  const [name, setName] = useState('peak-run-1');
  const [selectedScenario, setSelectedScenario] = useState('balanced_peak');
  const [controller, setController] = useState('qaoa');
  const [qaoaP, setQaoaP] = useState(1);
  const [qaoaShots, setQaoaShots] = useState(2048);
  const [seed, setSeed] = useState(42);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({
      name,
      scenario_id: selectedScenario,
      seed,
      controller,
      qaoa: controller === 'qaoa' ? { p: qaoaP, shots: qaoaShots, optimizer: 'COBYLA' } : undefined,
    });
  };

  return (
    <div className="embossed-plate rounded-sm p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative">
      {/* Corner Crop Marks */}
      <span className="absolute top-2 left-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌜</span>
      <span className="absolute top-2 right-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌝</span>

      <div className="flex flex-wrap items-center justify-between border-b border-[#2b2824] pb-3.5 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#c99a5b] text-xs font-mono">01 //</span>
            <h3 className="text-sm font-serif font-medium text-[#f5f2eb] uppercase tracking-[0.22em] text-embossed">
              Job Specification & Optimization Parameters
            </h3>
          </div>
          <p className="text-[10px] font-mono tracking-wider text-[#8a8070] mt-0.5 uppercase">
            Traffic Demand Matrix, Algorithmic Solvers & Deterministic Overrides
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-2.5 py-1 rounded-sm font-mono tracking-widest font-semibold uppercase border ${
            isRunning 
              ? 'bg-[#122319] text-[#2eb872] border-[#1e482f] shadow-[0_0_8px_rgba(46,184,114,0.2)]' 
              : 'bg-[#161513] text-[#7a7264] border-[#2b2824]'
          }`}>
            {isRunning ? '● RUNNING' : '○ STANDBY'}
          </span>
          <span className="text-[9px] font-mono tracking-widest text-[#5c5448] uppercase hidden sm:inline">
            TOLERANCE ±0.01
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
        {/* Experiment Name */}
        <div>
          <label className="text-[#a39886] block mb-1.5 text-[10px] font-mono tracking-widest uppercase">
            Run Identifier
          </label>
          <div className="debossed-well rounded-sm px-2.5 py-1.5">
            <input
              type="text"
              value={name}
              disabled={isRunning}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent text-[#f5f2eb] font-mono text-xs focus:outline-none disabled:opacity-40"
            />
          </div>
        </div>

        {/* Scenario Selection */}
        <div>
          <label className="text-[#a39886] block mb-1.5 text-[10px] font-mono tracking-widest uppercase">
            Demand Scenario
          </label>
          <div className="debossed-well rounded-sm px-2.5 py-1.5">
            <select
              value={selectedScenario}
              disabled={isRunning}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full bg-transparent text-[#f5f2eb] font-mono text-xs focus:outline-none disabled:opacity-40 cursor-pointer"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#181715] text-[#e8e1d5]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Controller Selection */}
        <div>
          <label className="text-[#a39886] block mb-1.5 text-[10px] font-mono tracking-widest uppercase">
            Solver Engine
          </label>
          <div className="debossed-well rounded-sm px-2.5 py-1.5">
            <select
              value={controller}
              disabled={isRunning}
              onChange={(e) => setController(e.target.value)}
              className="w-full bg-transparent text-[#c99a5b] font-mono text-xs font-semibold focus:outline-none disabled:opacity-40 cursor-pointer"
            >
              <option value="qaoa" className="bg-[#181715] text-[#c99a5b]">QAOA (Qiskit Aer)</option>
              <option value="exact" className="bg-[#181715] text-[#e8e1d5]">Exact Enumeration (MWIS)</option>
              <option value="greedy" className="bg-[#181715] text-[#e8e1d5]">Greedy MWIS</option>
              <option value="simulated_annealing" className="bg-[#181715] text-[#e8e1d5]">Simulated Annealing</option>
            </select>
          </div>
        </div>

        {/* Random Seed */}
        <div>
          <label className="text-[#a39886] block mb-1.5 text-[10px] font-mono tracking-widest uppercase">
            Stochastic Seed
          </label>
          <div className="debossed-well rounded-sm px-2.5 py-1.5">
            <input
              type="number"
              value={seed}
              disabled={isRunning}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full bg-transparent text-[#f5f2eb] font-mono text-xs focus:outline-none disabled:opacity-40"
            />
          </div>
        </div>

        {/* QAOA Parameters (if QAOA chosen) */}
        {controller === 'qaoa' && (
          <div className="col-span-full grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131210] p-3 rounded-sm border border-[#2b2824] shadow-inner">
            <div>
              <label className="text-[#8a8070] block mb-1 text-[9px] font-mono tracking-widest uppercase">
                Circuit Layers (p)
              </label>
              <div className="debossed-well rounded-sm px-2 py-1">
                <select
                  value={qaoaP}
                  disabled={isRunning}
                  onChange={(e) => setQaoaP(Number(e.target.value))}
                  className="w-full bg-transparent text-[#f5f2eb] font-mono text-xs focus:outline-none"
                >
                  <option value={1} className="bg-[#181715]">p = 1 (Fast Execution)</option>
                  <option value={2} className="bg-[#181715]">p = 2 (Higher Precision)</option>
                  <option value={3} className="bg-[#181715]">p = 3 (Deep Ansätz)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[#8a8070] block mb-1 text-[9px] font-mono tracking-widest uppercase">
                Sampling Shots
              </label>
              <div className="debossed-well rounded-sm px-2 py-1">
                <select
                  value={qaoaShots}
                  disabled={isRunning}
                  onChange={(e) => setQaoaShots(Number(e.target.value))}
                  className="w-full bg-transparent text-[#f5f2eb] font-mono text-xs focus:outline-none"
                >
                  <option value={512} className="bg-[#181715]">512 shots</option>
                  <option value={1024} className="bg-[#181715]">1024 shots</option>
                  <option value={2048} className="bg-[#181715]">2048 shots (Standard)</option>
                </select>
              </div>
            </div>

            <div className="col-span-2 flex items-center text-[10px] font-mono text-[#7a7264] tracking-wider">
              <span className="border-l border-[#2b2824] pl-3">
                Aer statevector backend with COBYLA classical variational parameter optimizer.
              </span>
            </div>
          </div>
        )}

        {/* Action Controls & Interactive Injections */}
        <div className="col-span-full flex flex-wrap items-center justify-between pt-3 border-t border-[#262420] gap-3">
          <div className="flex items-center gap-2.5">
            {!isRunning ? (
              <button
                type="submit"
                className="tactile-btn bg-[#18261e] border-[#264531] text-[#2eb872] px-4 py-2 rounded-sm font-mono text-xs tracking-widest uppercase flex items-center gap-2 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2eb872]" />
                <span>Initiate Simulation</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStop}
                className="tactile-btn bg-[#2b1816] border-[#4a2420] text-[#cf4338] px-4 py-2 rounded-sm font-mono text-xs tracking-widest uppercase flex items-center gap-2 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#cf4338]" />
                <span>Halt Simulation</span>
              </button>
            )}
          </div>

          {/* Manual Overrides */}
          {isRunning && (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onInjectPedestrian('North')}
                className="tactile-btn bg-[#1a1917] border-[#38342e] text-[#d4caba] px-3.5 py-1.5 rounded-sm font-mono text-[11px] tracking-wider uppercase flex items-center gap-1.5"
              >
                <span>🚶</span>
                <span>Call Pedestrian</span>
              </button>

              <button
                type="button"
                disabled={isEmergencyActive}
                onClick={() => onInjectEmergency('M0')}
                className={`tactile-btn font-mono text-[11px] tracking-wider uppercase px-3.5 py-1.5 rounded-sm flex items-center gap-1.5 ${
                  isEmergencyActive
                    ? 'bg-[#1b1414] border-[#381f1e] text-[#cf4338]/60 cursor-not-allowed'
                    : 'bg-[#2b1614] border-[#542420] text-[#cf4338] hover:bg-[#381d1a] shadow-[0_0_12px_rgba(207,67,56,0.25)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#cf4338] animate-ping" />
                <span>{isEmergencyActive ? 'Preemption Active' : 'Dispatch Emergency'}</span>
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

