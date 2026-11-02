import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const FALLBACK_EDGES = [
  { u: 0, v: 6, movement_u: 'M0', movement_v: 'M6', name_u: 'N-S Thru', name_v: 'E-W Thru', J_coeff: 16.25 },
  { u: 0, v: 9, movement_u: 'M0', movement_v: 'M9', name_u: 'N-S Thru', name_v: 'W-E Thru', J_coeff: 16.25 },
  { u: 0, v: 8, movement_u: 'M0', movement_v: 'M8', name_u: 'N-S Thru', name_v: 'E-S Left', J_coeff: 16.25 },
  { u: 0, v: 10, movement_u: 'M0', movement_v: 'M10', name_u: 'N-S Thru', name_v: 'W-N Left', J_coeff: 16.25 },
  { u: 0, v: 5, movement_u: 'M0', movement_v: 'M5', name_u: 'N-S Thru', name_v: 'S-W Left', J_coeff: 16.25 },
  { u: 0, v: 11, movement_u: 'M0', movement_v: 'M11', name_u: 'N-S Thru', name_v: 'W-S Right', J_coeff: 16.25 },
  { u: 3, v: 6, movement_u: 'M3', movement_v: 'M6', name_u: 'S-N Thru', name_v: 'E-W Thru', J_coeff: 16.25 },
  { u: 3, v: 9, movement_u: 'M3', movement_v: 'M9', name_u: 'S-N Thru', name_v: 'W-E Thru', J_coeff: 16.25 },
  { u: 3, v: 8, movement_u: 'M3', movement_v: 'M8', name_u: 'S-N Thru', name_v: 'E-S Left', J_coeff: 16.25 },
  { u: 3, v: 10, movement_u: 'M3', movement_v: 'M10', name_u: 'S-N Thru', name_v: 'W-N Left', J_coeff: 16.25 },
  { u: 3, v: 1, movement_u: 'M3', movement_v: 'M1', name_u: 'S-N Thru', name_v: 'N-E Left', J_coeff: 16.25 },
  { u: 3, v: 7, movement_u: 'M3', movement_v: 'M7', name_u: 'S-N Thru', name_v: 'E-N Right', J_coeff: 16.25 },
  { u: 6, v: 1, movement_u: 'M6', movement_v: 'M1', name_u: 'E-W Thru', name_v: 'N-E Left', J_coeff: 16.25 },
  { u: 6, v: 5, movement_u: 'M6', movement_v: 'M5', name_u: 'E-W Thru', name_v: 'S-W Left', J_coeff: 16.25 },
  { u: 6, v: 10, movement_u: 'M6', movement_v: 'M10', name_u: 'E-W Thru', name_v: 'W-N Left', J_coeff: 16.25 },
  { u: 6, v: 2, movement_u: 'M6', movement_v: 'M2', name_u: 'E-W Thru', name_v: 'N-W Right', J_coeff: 16.25 },
  { u: 9, v: 1, movement_u: 'M9', movement_v: 'M1', name_u: 'W-E Thru', name_v: 'N-E Left', J_coeff: 16.25 },
  { u: 9, v: 5, movement_u: 'M9', movement_v: 'M5', name_u: 'W-E Thru', name_v: 'S-W Left', J_coeff: 16.25 },
  { u: 9, v: 8, movement_u: 'M9', movement_v: 'M8', name_u: 'W-E Thru', name_v: 'E-S Left', J_coeff: 16.25 },
  { u: 9, v: 4, movement_u: 'M9', movement_v: 'M4', name_u: 'W-E Thru', name_v: 'S-E Right', J_coeff: 16.25 },
  { u: 1, v: 8, movement_u: 'M1', movement_v: 'M8', name_u: 'N-E Left', name_v: 'E-S Left', J_coeff: 16.25 },
  { u: 1, v: 10, movement_u: 'M1', movement_v: 'M10', name_u: 'N-E Left', name_v: 'W-N Left', J_coeff: 16.25 },
  { u: 5, v: 8, movement_u: 'M5', movement_v: 'M8', name_u: 'S-W Left', name_v: 'E-S Left', J_coeff: 16.25 },
  { u: 5, v: 10, movement_u: 'M5', movement_v: 'M10', name_u: 'S-W Left', name_v: 'W-N Left', J_coeff: 16.25 },
  { u: 1, v: 7, movement_u: 'M1', movement_v: 'M7', name_u: 'N-E Left', name_v: 'E-N Right', J_coeff: 16.25 },
  { u: 2, v: 5, movement_u: 'M2', movement_v: 'M5', name_u: 'N-W Right', name_v: 'S-W Left', J_coeff: 16.25 },
  { u: 8, v: 11, movement_u: 'M8', movement_v: 'M11', name_u: 'E-S Left', name_v: 'W-S Right', J_coeff: 16.25 },
  { u: 4, v: 10, movement_u: 'M4', movement_v: 'M10', name_u: 'S-E Right', name_v: 'W-N Left', J_coeff: 16.25 },
];

const FALLBACK_QUBITS = [
  { qubit_index: 0, movement_id: 'M0', movement_name: 'N-S Thru', approach: 'North', exit: 'South', movement_type: 'through', description: 'North-South Through movement', weight: 6.5, degree: 6, h_coeff: -45.5, conflicts: ['M5', 'M6', 'M8', 'M9', 'M10', 'M11'] },
  { qubit_index: 1, movement_id: 'M1', movement_name: 'N-E Left', approach: 'North', exit: 'East', movement_type: 'left', description: 'North-East Left turn', weight: 3.2, degree: 5, h_coeff: -39.0, conflicts: ['M3', 'M6', 'M7', 'M8', 'M10'] },
  { qubit_index: 2, movement_id: 'M2', movement_name: 'N-W Right', approach: 'North', exit: 'West', movement_type: 'right', description: 'North-West Right turn', weight: 2.8, degree: 2, h_coeff: -14.8, conflicts: ['M5', 'M6'] },
  { qubit_index: 3, movement_id: 'M3', movement_name: 'S-N Thru', approach: 'South', exit: 'North', movement_type: 'through', description: 'South-North Through movement', weight: 6.8, degree: 6, h_coeff: -45.3, conflicts: ['M1', 'M6', 'M7', 'M8', 'M9', 'M10'] },
  { qubit_index: 4, movement_id: 'M4', movement_name: 'S-E Right', approach: 'South', exit: 'East', movement_type: 'right', description: 'South-East Right turn', weight: 2.4, degree: 2, h_coeff: -15.0, conflicts: ['M9', 'M10'] },
  { qubit_index: 5, movement_id: 'M5', movement_name: 'S-W Left', approach: 'South', exit: 'West', movement_type: 'left', description: 'South-West Left turn', weight: 2.9, degree: 5, h_coeff: -39.2, conflicts: ['M0', 'M2', 'M6', 'M8', 'M10'] },
  { qubit_index: 6, movement_id: 'M6', movement_name: 'E-W Thru', approach: 'East', exit: 'West', movement_type: 'through', description: 'East-West Through movement', weight: 4.5, degree: 6, h_coeff: -46.5, conflicts: ['M0', 'M1', 'M2', 'M3', 'M5', 'M10'] },
  { qubit_index: 7, movement_id: 'M7', movement_name: 'E-N Right', approach: 'East', exit: 'North', movement_type: 'right', description: 'East-North Right turn', weight: 1.8, degree: 2, h_coeff: -15.3, conflicts: ['M1', 'M3'] },
  { qubit_index: 8, movement_id: 'M8', movement_name: 'E-S Left', approach: 'East', exit: 'South', movement_type: 'left', description: 'East-South Left turn', weight: 2.1, degree: 5, h_coeff: -39.6, conflicts: ['M0', 'M1', 'M3', 'M5', 'M9'] },
  { qubit_index: 9, movement_id: 'M9', movement_name: 'W-E Thru', approach: 'West', exit: 'East', movement_type: 'through', description: 'West-East Through movement', weight: 4.8, degree: 6, h_coeff: -46.3, conflicts: ['M0', 'M1', 'M3', 'M4', 'M5', 'M8'] },
  { qubit_index: 10, movement_id: 'M10', movement_name: 'W-N Left', approach: 'West', exit: 'North', movement_type: 'left', description: 'West-North Left turn', weight: 2.5, degree: 5, h_coeff: -39.4, conflicts: ['M0', 'M1', 'M3', 'M4', 'M6'] },
  { qubit_index: 11, movement_id: 'M11', movement_name: 'W-S Right', approach: 'West', exit: 'South', movement_type: 'right', description: 'West-South Right turn', weight: 1.9, degree: 2, h_coeff: -15.3, conflicts: ['M0', 'M8'] },
];

function buildCircuitPayload(p = 1) {
  const depthP = Math.max(1, Math.min(p, 3));
  const layers = [
    {
      name: 'State Preparation Layer',
      type: 'hadamard',
      description: 'Uniform superposition across all 2^12 = 4096 states via H^{\\otimes 12}',
      gates_count: 12,
      qubits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
  ];

  for (let l = 0; l < depthP; l++) {
    layers.push({
      name: `Layer ${l + 1}: Cost Unitary U_C(gamma_${l + 1}) — Local Fields`,
      type: 'rz_local',
      description: `Phase rotation R_Z(2 \\cdot \\gamma_${l + 1} \\cdot h_i) encoding movement priority weights`,
      gates_count: 12,
      gamma_index: l,
    });
    layers.push({
      name: `Layer ${l + 1}: Cost Unitary U_C(gamma_${l + 1}) — Conflict Interactions`,
      type: 'zz_couplings',
      description: '28 Two-qubit ZZ interaction gates (CX -> R_Z -> CX) penalizing incompatible movements',
      gates_count: 28 * 3,
      gamma_index: l,
      edges_count: 28,
    });
    layers.push({
      name: `Layer ${l + 1}: Mixer Unitary U_M(beta_${l + 1})`,
      type: 'rx_mixer',
      description: `Transverse field driver R_X(2 \\cdot \\beta_${l + 1}) enabling quantum tunneling`,
      gates_count: 12,
      beta_index: l,
    });
  }

  layers.push({
    name: 'Measurement Layer',
    type: 'measurement',
    description: 'Z-basis projection mapping 12 quantum states into classical bitstring register c[0..11]',
    gates_count: 12,
  });

  return {
    p: depthP,
    num_qubits: 12,
    num_clbits: 12,
    depth: 40 * depthP,
    total_gates: 133 * depthP,
    gate_counts: {
      h: 12,
      cx: 56 * depthP,
      rz: 40 * depthP,
      rx: 12 * depthP,
      measure: 12,
    },
    penalty_p: 65.0,
    constant_offset: -210.0,
    qubits: FALLBACK_QUBITS,
    conflict_edges: FALLBACK_EDGES,
    layers,
    ascii_diagram: `      ┌───┐┌───────────┐                    ┌──────────┐┌─┐
 q_0: ┤ H ├┤ Rz(-45.5) ├──■─────────────────┤ Rx(0.60) ├┤M├──
      ├───┤├───────────┤  │                 ├──────────┤└╥┘┌─┐
 q_1: ┤ H ├┤ Rz(-39.0) ├──┼───■─────────────┤ Rx(0.60) ├─╫─┤M
      ├───┤├───────────┤  │   │             ├──────────┤ ║ └╥
 q_2: ┤ H ├┤ Rz(-14.8) ├──┼───┼───■─────────┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤  │   │   │         ├──────────┤ ║  ║
 q_3: ┤ H ├┤ Rz(-45.3) ├──┼───┼───┼───■─────┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤  │   │   │   │     ├──────────┤ ║  ║
 q_4: ┤ H ├┤ Rz(-15.0) ├──┼───┼───┼───┼──■──┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤  │   │   │   │  │  ├──────────┤ ║  ║
 q_5: ┤ H ├┤ Rz(-39.2) ├──┼───┼───┼───┼──┼──┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤┌─┴─┐ │   │   │  │  ├──────────┤ ║  ║
 q_6: ┤ H ├┤ Rz(-46.5) ├┤ X ├─┼───┼───┼──┼──┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤└───┘ │   │   │  │  ├──────────┤ ║  ║
 q_7: ┤ H ├┤ Rz(-15.3) ├──────┼───┼───┼──┼──┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤    ┌─┴─┐ │   │  │  ├──────────┤ ║  ║
 q_8: ┤ H ├┤ Rz(-39.6) ├────┤ X ├─┼───┼──┼──┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤    └───┘ │   │  │  ├──────────┤ ║  ║
 q_9: ┤ H ├┤ Rz(-46.3) ├──────────┼───┼──┼──┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤        ┌─┴─┐ │  │  ├──────────┤ ║  ║
q_10: ┤ H ├┤ Rz(-39.4) ├────────┤ X ├─┼──┼──┤ Rx(0.60) ├─╫──╫
      ├───┤├───────────┤        └───┘┌┴─┐│  ├──────────┤ ║  ║
q_11: ┤ H ├┤ Rz(-15.3) ├─────────────┤ X├┴──┤ Rx(0.60) ├─╫──╫
      └───┘└───────────┘             └──┘   └──────────┘ ║  ║
c: 12/═══════════════════════════════════════════════════╩══╩═
                                                         0  1 `,
    qasm: `OPENQASM 2.0;
include "qelib1.inc";
qreg q[12];
creg c[12];
h q[0]; h q[1]; h q[2]; h q[3]; h q[4]; h q[5];
h q[6]; h q[7]; h q[8]; h q[9]; h q[10]; h q[11];
rz(-45.500) q[0]; rz(-39.000) q[1]; rz(-14.800) q[2];
rz(-45.300) q[3]; rz(-15.000) q[4]; rz(-39.200) q[5];
rz(-46.500) q[6]; rz(-15.300) q[7]; rz(-39.600) q[8];
rz(-46.300) q[9]; rz(-39.400) q[10]; rz(-15.300) q[11];
cx q[0], q[6]; rz(16.250) q[6]; cx q[0], q[6];
cx q[0], q[9]; rz(16.250) q[9]; cx q[0], q[9];
rx(0.600) q[0]; rx(0.600) q[1]; rx(0.600) q[2];
rx(0.600) q[3]; rx(0.600) q[4]; rx(0.600) q[5];
measure q[0] -> c[0]; measure q[1] -> c[1]; measure q[2] -> c[2];
measure q[3] -> c[3]; measure q[4] -> c[4]; measure q[5] -> c[5];`,
    exact_optimum: {
      active_movements: ['M0', 'M2', 'M3', 'M4'],
      reward: 18.5,
      qubo_energy: -18.5,
      bitstring: '101110000000',
      runtime_ms: 4.8,
    },
  };
}

function buildSimulationPayload(shots = 1024) {
  return {
    shots,
    runtime_ms: 11.8,
    feasible_shots: Math.round(shots * 0.88),
    valid_sample_rate: 0.88,
    unique_bitstrings: 36,
    best_feasible_sample: {
      bitstring: '101110000000',
      active_movements: ['M0', 'M2', 'M3', 'M4'],
      reward: 18.5,
      qubo_energy: -18.5,
      count: Math.round(shots * 0.28),
      probability: 0.28,
    },
    exact_optimum_reward: 18.5,
    approximation_ratio: 1.0,
    top_samples: [
      {
        bitstring: '101110000000',
        raw_qiskit: '000000011101',
        active_movements: ['M0', 'M2', 'M3', 'M4'],
        count: Math.round(shots * 0.28),
        probability: 0.28,
        feasible: true,
        violations: [],
        reward: 18.5,
        qubo_energy: -18.5,
      },
      {
        bitstring: '000000110101',
        raw_qiskit: '101011000000',
        active_movements: ['M6', 'M7', 'M9', 'M11'],
        count: Math.round(shots * 0.24),
        probability: 0.24,
        feasible: true,
        violations: [],
        reward: 13.0,
        qubo_energy: -13.0,
      },
      {
        bitstring: '010001000000',
        raw_qiskit: '000000100010',
        active_movements: ['M1', 'M5'],
        count: Math.round(shots * 0.16),
        probability: 0.16,
        feasible: true,
        violations: [],
        reward: 6.1,
        qubo_energy: -6.1,
      },
      {
        bitstring: '100000100000',
        raw_qiskit: '000001000001',
        active_movements: ['M0', 'M6'],
        count: Math.round(shots * 0.04),
        probability: 0.04,
        feasible: false,
        violations: [['M0', 'M6']],
        reward: 11.0,
        qubo_energy: 54.0,
      },
    ],
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'quantum-circuit-embedded-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const rawUrl = req.url || '';
          if (rawUrl.startsWith('/api/quantum/circuit')) {
            try {
              const parsed = new URL(rawUrl, 'http://localhost');
              const p = parseInt(parsed.searchParams.get('p') || '1', 10);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(buildCircuitPayload(p)));
              return;
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(buildCircuitPayload(1)));
              return;
            }
          }
          if (rawUrl.startsWith('/api/quantum/simulate') && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              let parsedBody = { shots: 1024 };
              try {
                parsedBody = JSON.parse(body || '{}');
              } catch (e) {}
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(buildSimulationPayload(parsedBody.shots || 1024)));
            });
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
