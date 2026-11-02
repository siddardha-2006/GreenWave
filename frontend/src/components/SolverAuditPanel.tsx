import React from 'react';
import { SolverResult } from '../types';

interface SolverAuditPanelProps {
  solvers: SolverResult[];
  latestResult: SolverResult | null;
}

export const SolverAuditPanel: React.FC<SolverAuditPanelProps> = ({ solvers, latestResult }) => {
  return (
    <div className="embossed-plate rounded-sm p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-4 relative">
      {/* Corner Crop Marks */}
      <span className="absolute top-2 left-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌜</span>
      <span className="absolute top-2 right-2 text-[#38342e] font-mono text-xs select-none pointer-events-none">⌝</span>

      <div className="flex flex-wrap items-center justify-between border-b border-[#2b2824] pb-3.5 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[#c99a5b] text-xs font-mono">03 //</span>
            <h3 className="text-sm font-serif font-medium text-[#f5f2eb] uppercase tracking-[0.22em] text-embossed">
              Quantum Optimization & Feasibility Audit Ledger
            </h3>
          </div>
          <p className="text-[10px] font-mono tracking-wider text-[#8a8070] mt-0.5 uppercase">
            Continuous Verification of Candidate Maximum Weight Independent Sets (MWIS)
          </p>
        </div>
        <span className="text-[9px] bg-[#161513] text-[#c99a5b] border border-[#38342e] px-2.5 py-1 rounded-sm font-mono tracking-widest uppercase">
          ALGORITHM // QUBO-MWIS
        </span>
      </div>

      {/* Latest Decision Card */}
      {latestResult ? (
        <div className="debossed-well rounded-sm p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">Active Solver</span>
            <span className="font-mono font-bold text-[#c99a5b] tracking-wider text-xs">{(latestResult.solver || 'QAOA').toUpperCase()}</span>
          </div>

          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">Candidate Set</span>
            <span className="font-mono font-bold text-[#2eb872] tracking-wider text-xs">
              {Array.isArray(latestResult.active_movements) && latestResult.active_movements.length > 0
                ? latestResult.active_movements.join(', ')
                : 'NONE'}
            </span>
          </div>

          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">Feasibility Proof</span>
            <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold tracking-wider ${
              latestResult.feasible ? 'text-[#2eb872]' : 'text-[#cf4338]'
            }`}>
              {latestResult.feasible ? '✓ FEASIBLE (NO CONFLICTS)' : '✗ INFEASIBLE'}
            </span>
          </div>

          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">Valid Sample Rate</span>
            <span className="font-mono text-[#d99b26] text-xs">
              {typeof latestResult.valid_sample_rate === 'number'
                ? `${(latestResult.valid_sample_rate * 100).toFixed(1)}% OF SHOTS`
                : '100%'}
            </span>
          </div>

          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">MWIS Reward</span>
            <span className="font-mono font-bold text-[#f5f2eb] text-xs">
              {typeof latestResult.objective_reward === 'number'
                ? latestResult.objective_reward.toFixed(2)
                : '0.00'}
            </span>
          </div>

          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">QUBO Energy</span>
            <span className="font-mono text-[#a39886] text-xs">
              {typeof latestResult.qubo_energy === 'number'
                ? latestResult.qubo_energy.toFixed(2)
                : '0.00'}
            </span>
          </div>

          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">Runtime Latency</span>
            <span className="font-mono text-[#b0b7c0] text-xs">
              {typeof latestResult.runtime_ms === 'number'
                ? `${latestResult.runtime_ms.toFixed(1)} MS`
                : '0.0 MS'}
            </span>
          </div>

          <div>
            <span className="text-[#736b5e] block text-[9px] font-mono uppercase tracking-widest">Approximation Ratio</span>
            <span className="font-mono font-bold text-[#c99a5b] text-xs">
              {typeof latestResult.approximation_ratio === 'number' && !isNaN(latestResult.approximation_ratio)
                ? latestResult.approximation_ratio.toFixed(4)
                : '1.0000'}
            </span>
          </div>
        </div>
      ) : (
        <div className="debossed-well p-4 rounded-sm text-center font-mono text-[11px] tracking-widest text-[#736b5e] uppercase">
          STANDBY // AWAITING SIMULATION INITIATION...
        </div>
      )}

      {/* Solver Comparison History Table */}
      <div>
        <div className="text-[10px] font-mono text-[#a39886] uppercase tracking-[0.2em] mb-2">
          Decision Audit Log [Historical Record]
        </div>
        <div className="max-h-48 overflow-y-auto border border-[#262420] rounded-sm bg-[#131210]">
          <table className="w-full text-left text-xs text-[#d4caba]">
            <thead className="bg-[#0c0b0a] text-[#736b5e] text-[9px] font-mono uppercase tracking-[0.2em] sticky top-0 border-b border-[#262420]">
              <tr>
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Solver</th>
                <th className="py-2 px-3">Independent Set</th>
                <th className="py-2 px-3">Reward</th>
                <th className="py-2 px-3">Feasible</th>
                <th className="py-2 px-3">Runtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#201e1a] font-mono text-[11px]">
              {!Array.isArray(solvers) || solvers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-[#5c5448] font-mono text-[10px] tracking-widest uppercase">
                    No decisions registered in ledger yet.
                  </td>
                </tr>
              ) : (
                solvers.slice(-15).reverse().map((s, idx) => (
                  <tr key={idx} className="hover:bg-[#1a1917] transition-colors">
                    <td className="py-1.5 px-3 text-[#8a8070]">
                      {typeof s?.simulation_time === 'number' ? `${s.simulation_time.toFixed(1)}s` : '0.0s'}
                    </td>
                    <td className="py-1.5 px-3 text-[#c99a5b] font-semibold">{s?.solver || 'solver'}</td>
                    <td className="py-1.5 px-3 text-[#2eb872]">
                      {Array.isArray(s?.active_movements) ? s.active_movements.join(', ') : ''}
                    </td>
                    <td className="py-1.5 px-3 text-[#d99b26]">
                      {typeof s?.objective_reward === 'number' ? s.objective_reward.toFixed(1) : '0.0'}
                    </td>
                    <td className="py-1.5 px-3">
                      <span className={s?.feasible ? 'text-[#2eb872]' : 'text-[#cf4338]'}>
                        {s?.feasible ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-[#b0b7c0]">
                      {typeof s?.runtime_ms === 'number' ? `${s.runtime_ms.toFixed(1)}ms` : '0.0ms'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
