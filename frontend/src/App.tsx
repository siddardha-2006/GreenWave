import React, { useEffect, useRef, useState } from 'react';
import { Experiment, ScenarioInfo, SimulationMetrics, SolverResult, TelemetryMessage } from './types';
import { Realistic3DIntersection } from './components/Realistic3DIntersection';
import { IntersectionView } from './components/IntersectionView';
import { ExperimentControls } from './components/ExperimentControls';
import { TelemetryCharts } from './components/TelemetryCharts';
import { SolverAuditPanel } from './components/SolverAuditPanel';
import { QuantumCircuitVisualizer } from './components/QuantumCircuitVisualizer';
import { ErrorBoundary } from './components/ErrorBoundary';

export const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'simulation' | 'quantum'>('simulation');
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<SimulationMetrics[]>([]);
  const [solvers, setSolvers] = useState<SolverResult[]>([]);
  const [phaseType, setPhaseType] = useState('all_red');
  const [timeInPhase, setTimeInPhase] = useState(0.0);
  const [fallbackEngaged, setFallbackEngaged] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  const wsRef = useRef<WebSocket | null>(null);

  // Load scenarios on mount
  useEffect(() => {
    fetch('/api/scenarios')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load scenarios');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setScenarios(data);
      })
      .catch((err) => console.error('Failed to load scenarios:', err));
  }, []);

  // Polling Fallback: Ensures live metrics update continuously even if WebSocket disconnects
  useEffect(() => {
    if (!activeExperiment || !isRunning) return;

    const pollInterval = setInterval(() => {
      // 1. Fetch latest state & metrics
      fetch(`/api/experiments/${activeExperiment.id}/metrics?limit=1`)
        .then((res) => (res.ok ? res.json() : []))
        .then((docs) => {
          if (Array.isArray(docs) && docs.length > 0) {
            const m = docs[docs.length - 1] as SimulationMetrics;
            setMetrics(m);
            setMetricsHistory((prev) => [...prev.slice(-60), m]);
          }
        })
        .catch(() => {});

      // 2. Fetch experiment status
      fetch(`/api/experiments/${activeExperiment.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((exp) => {
          if (exp && ['completed', 'cancelled', 'failed'].includes(exp.status)) {
            setIsRunning(false);
          }
        })
        .catch(() => {});

      // 3. Fetch solver comparison logs
      fetch(`/api/experiments/${activeExperiment.id}/solvers`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setSolvers(data);
        })
        .catch(() => {});
    }, 600);

    return () => clearInterval(pollInterval);
  }, [activeExperiment, isRunning]);

  // Connect WebSocket when an experiment is started
  const connectWebSocket = (expId: string) => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/experiments/${expId}`;
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'telemetry') {
            const m = data.metrics as SimulationMetrics;
            if (m) {
              setMetrics(m);
              setMetricsHistory((prev) => [...prev.slice(-60), m]);
            }
            if (data.safety) {
              setPhaseType(data.safety.phase_type || 'all_red');
              setTimeInPhase(Number(data.safety.time_in_phase) || 0.0);
              setFallbackEngaged(Boolean(data.safety.fallback_engaged));
              setRejectionReason(data.safety.rejection_reason);
            }
          } else if (data?.type === 'status') {
            if (['completed', 'cancelled', 'failed'].includes(data.status)) {
              setIsRunning(false);
            }
          }
        } catch (err) {
          console.error('Error parsing telemetry:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection notice (polling fallback active):', err);
      };

      wsRef.current = ws;
    } catch (ex) {
      console.warn('WebSocket init fallback:', ex);
    }
  };

  // Start experiment
  const handleStart = async (config: any) => {
    try {
      // 1. Create experiment
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to create experiment.');
      const exp: Experiment = await res.json();
      setActiveExperiment(exp);

      // 2. Start background simulation loop
      const startRes = await fetch(`/api/experiments/${exp.id}/start`, { method: 'POST' });
      if (!startRes.ok) throw new Error('Failed to start simulation.');

      setIsRunning(true);
      setMetricsHistory([]);
      setSolvers([]);

      // 3. Connect live WebSocket
      connectWebSocket(exp.id);
    } catch (err) {
      console.error('Error starting experiment:', err);
      alert('Failed to start simulation. Check backend console logs.');
    }
  };

  // Stop experiment
  const handleStop = async () => {
    if (!activeExperiment) return;
    try {
      await fetch(`/api/experiments/${activeExperiment.id}/stop`, { method: 'POST' });
      setIsRunning(false);
    } catch (err) {
      console.error('Error stopping experiment:', err);
    }
  };

  // Trigger pedestrian
  const handleInjectPedestrian = async (approach: string) => {
    if (!activeExperiment) return;
    try {
      await fetch(`/api/experiments/${activeExperiment.id}/inject_pedestrian?approach=${approach}`, { method: 'POST' });
    } catch (err) {
      console.error('Error injecting pedestrian:', err);
    }
  };

  const isEmergencyActive = metrics?.emergency_state === 'approaching' || 
                            metrics?.emergency_state === 'active' || 
                            metrics?.emergency_state === 'preempting';

  // Trigger emergency
  const handleInjectEmergency = async (movement: string) => {
    if (!activeExperiment || isEmergencyActive) return;
    try {
      await fetch(`/api/experiments/${activeExperiment.id}/inject_emergency?movement=${movement}`, { method: 'POST' });
    } catch (err) {
      console.error('Error injecting emergency:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#11100e] text-[#e8e1d5] flex flex-col font-sans selection:bg-[#c99a5b]/30 selection:text-[#f5f2eb] bg-board-canvas">
      {/* Editorial Tactile Master Header */}
      <header className="border-b border-[#2b2824] bg-[#161513]/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
        {/* Left: Brand Plate with Blind Embossed Seal */}
        <div className="flex items-center gap-3.5">
          <div className="relative w-10 h-10 rounded-sm bg-[#1c1a17] border border-[#38342e] flex items-center justify-center text-xs font-serif font-bold text-[#f5f2eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_6px_rgba(0,0,0,0.6)]">
            <span className="text-embossed font-serif text-sm tracking-widest">GW</span>
            {/* Subtle corner registration dots */}
            <span className="absolute top-1 left-1 w-0.5 h-0.5 rounded-full bg-[#c99a5b]/50"></span>
            <span className="absolute bottom-1 right-1 w-0.5 h-0.5 rounded-full bg-[#c99a5b]/50"></span>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-serif font-medium tracking-[0.24em] uppercase text-[#f5f2eb] text-embossed">
                GREEN • WAVE
              </h1>
              <span className="text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 bg-[#0c0b0a] border border-[#2b2824] text-[#a39886] rounded-sm">
                SPEC // QAOA-QUBO
              </span>
              <span className="text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 bg-[#0c0b0a] border border-[#2b2824] text-[#c99a5b] rounded-sm">
                12-QUBIT CORE
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-[0.16em] uppercase text-[#7a7264] mt-0.5">
              Autonomous Traffic Artifact & Quantum Optical Synthesis
            </p>
          </div>
        </div>

        {/* Center: Die-Cut Index Tab Navigation */}
        <nav className="flex items-center bg-[#0c0b0a] p-1 rounded-sm border border-[#262420] text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
          <button
            onClick={() => setCurrentPage('simulation')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-sm font-mono text-[11px] tracking-wider uppercase transition-all duration-150 ${
              currentPage === 'simulation'
                ? 'bg-[#22201c] text-[#f5f2eb] border border-[#3d3932] shadow-[0_1px_3px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-[#8a8070] hover:text-[#e8e1d5] hover:bg-[#161513]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2eb872] shadow-[0_0_6px_rgba(46,184,114,0.6)]" />
            <span>01 // Simulation View</span>
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#c99a5b] animate-ping ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setCurrentPage('quantum')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-sm font-mono text-[11px] tracking-wider uppercase transition-all duration-150 ${
              currentPage === 'quantum'
                ? 'bg-[#22201c] text-[#f5f2eb] border border-[#3d3932] shadow-[0_1px_3px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-[#8a8070] hover:text-[#e8e1d5] hover:bg-[#161513]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#c99a5b] shadow-[0_0_6px_rgba(201,154,91,0.6)]" />
            <span>02 // Quantum Circuit</span>
            <span className="text-[9px] font-mono text-[#a39886] border border-[#38342e] px-1 py-0.2 rounded-sm bg-[#161513]">
              12-Q
            </span>
          </button>
        </nav>

        {/* Right: Technical Badges & Perspective Selector */}
        <div className="flex items-center gap-3">
          {currentPage === 'simulation' ? (
            <>
              <div className="hidden xl:flex items-center gap-2 bg-[#171513] border border-[#2f2b25] px-2.5 py-1 rounded-sm text-[10px] font-mono tracking-widest text-[#a39886]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d99b26]" />
                <span>SAFETY CONTROLLER // GOVERNING</span>
              </div>

              <div className="flex items-center bg-[#0c0b0a] p-0.5 rounded-sm border border-[#262420] text-xs">
                <button
                  onClick={() => setViewMode('3d')}
                  className={`px-3 py-1 rounded-sm font-mono text-[10px] tracking-wider uppercase transition ${
                    viewMode === '3d'
                      ? 'bg-[#22201c] text-[#f5f2eb] border border-[#38342e] shadow-sm'
                      : 'text-[#7a7264] hover:text-[#d4caba]'
                  }`}
                >
                  3D Spatial
                </button>
                <button
                  onClick={() => setViewMode('2d')}
                  className={`px-3 py-1 rounded-sm font-mono text-[10px] tracking-wider uppercase transition ${
                    viewMode === '2d'
                      ? 'bg-[#22201c] text-[#f5f2eb] border border-[#38342e] shadow-sm'
                      : 'text-[#7a7264] hover:text-[#d4caba]'
                  }`}
                >
                  2D Plan
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-[#171513] border border-[#2f2b25] px-3 py-1 rounded-sm text-[10px] font-mono tracking-widest text-[#c99a5b]">
              <span>⚛ AER SIMULATOR</span>
              <span className="text-[#3d3830]">•</span>
              <span className="text-[#e8e1d5]">MWIS VERIFICATION</span>
            </div>
          )}
        </div>
      </header>

      {/* Workshop Registration Sub-Bar (Packaging Crease & Job Info) */}
      <div className="border-b border-[#201e1a] bg-[#131210] px-6 py-1.5 flex flex-wrap items-center justify-between text-[9px] font-mono tracking-[0.2em] text-[#6e6659] uppercase">
        <div className="flex items-center gap-4">
          <span>PLATE REF: GW-2026-QAOA</span>
          <span className="text-[#2b2824]">•</span>
          <span>CALIBRATION: DETERMINISTIC CLEARANCE</span>
          <span className="text-[#2b2824]">•</span>
          <span className="text-[#a39886]">SUBSTRATE: 350 GSM GRAPHITE</span>
        </div>
        <div className="flex items-center gap-3">
          <span>STATUS: {isRunning ? 'EXECUTING SIMULATION' : 'STANDBY'}</span>
          <span className="text-[#2b2824]">•</span>
          <span>LATENCY: ~16 MS</span>
        </div>
      </div>

      {/* Main Container with Tactile Framing */}
      <main className="flex-1 p-5 max-w-7xl w-full mx-auto flex flex-col gap-5 relative">
        {/* Subtle Corner Registration Crop Marks */}
        <div className="absolute top-2 left-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌜</div>
        <div className="absolute top-2 right-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌝</div>
        <div className="absolute bottom-2 left-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌞</div>
        <div className="absolute bottom-2 right-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌟</div>

        {currentPage === 'quantum' ? (
          <QuantumCircuitVisualizer
            scenarios={scenarios}
            activeExperimentId={activeExperiment?.id}
          />
        ) : (
          <>
            {/* Controls & Configuration Plate */}
            <ExperimentControls
              scenarios={scenarios}
              activeExperiment={activeExperiment}
              isRunning={isRunning}
              isEmergencyActive={isEmergencyActive}
              onStart={handleStart}
              onStop={handleStop}
              onInjectPedestrian={handleInjectPedestrian}
              onInjectEmergency={handleInjectEmergency}
            />

            {/* Primary View Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Main Simulation Viewport (3D Realistic or 2D Schematic) */}
              <div className="lg:col-span-7">
                {viewMode === '3d' ? (
                  <Realistic3DIntersection
                    metrics={metrics}
                    phaseType={phaseType}
                    timeInPhase={timeInPhase}
                    fallbackEngaged={fallbackEngaged}
                    rejectionReason={rejectionReason}
                  />
                ) : (
                  <IntersectionView
                    metrics={metrics}
                    phaseType={phaseType}
                    timeInPhase={timeInPhase}
                    fallbackEngaged={fallbackEngaged}
                    rejectionReason={rejectionReason}
                  />
                )}
              </div>

              {/* Real-time Telemetry KPIs (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                <TelemetryCharts metrics={metrics} history={metricsHistory} />
              </div>

              {/* Full-width Solver Audit Panel */}
              <div className="lg:col-span-12">
                <SolverAuditPanel solvers={solvers} latestResult={solvers[solvers.length - 1] || null} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* Editorial Tactile Master Footer */}
      <footer className="border-t border-[#262420] bg-[#131210] px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono tracking-[0.22em] text-[#736a5c] uppercase">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#c99a5b]/60 rounded-full" />
          <span>GREEN-WAVE CORE // TACTILE ARTIFACT EDITION</span>
        </div>
        <div className="text-center">
          ECLIPSE SUMO TraCI & QISKIT AER OPTIMIZATION • DETERMINISTIC SAFETY LOCK
        </div>
        <div>
          MWIS QUBO HYBRID ENGINE // CALIBRATED
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};
