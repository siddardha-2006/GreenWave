export interface Experiment {
  id: string;
  name: string;
  scenario_id: string;
  seed: number;
  status: 'queued' | 'running' | 'stopping' | 'completed' | 'failed' | 'cancelled';
  controller: string;
  qaoa?: {
    p: number;
    shots: number;
    optimizer: string;
  };
  config_version: string;
  started_at?: string;
  completed_at?: string;
  current_simulation_time: number;
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
  duration_seconds: number;
}

export interface SimulationMetrics {
  experiment_id: string;
  simulation_time: number;
  queue_lengths: Record<string, number>;
  mean_waiting_time: number;
  max_waiting_time: number;
  throughput: number;
  active_movements: string[];
  signal_colors: Record<string, 'green' | 'yellow' | 'red'>;
  pedestrian_state: 'idle' | 'waiting' | 'walk' | 'clearance';
  emergency_state: 'none' | 'approaching' | 'preempting' | 'active' | 'recovering';
  emergency_movement?: string;
  emergency_approach?: string;
  pedestrian_wait_time: number;
  emergency_delay: number;
}

export interface SolverResult {
  experiment_id: string;
  simulation_time: number;
  solver: string;
  objective_reward: number;
  qubo_energy: number;
  bitstring: string;
  active_movements: string[];
  feasible: boolean;
  valid_sample_rate: number;
  runtime_ms: number;
  fallback_used: boolean;
  approximation_ratio?: number;
}

export interface TelemetryMessage {
  type: 'telemetry' | 'status';
  experiment_id: string;
  metrics: SimulationMetrics;
  safety: {
    phase_type: string;
    time_in_phase: number;
    fallback_engaged: boolean;
    rejection_reason?: string;
  };
  emergency?: {
    state: string;
    movement?: string;
    approach?: string;
  };
}

export interface QubitMeta {
  qubit_index: number;
  movement_id: string;
  movement_name: string;
  approach: string;
  exit: string;
  movement_type: string;
  description: string;
  weight: number;
  degree: number;
  h_coeff: number;
  conflicts: string[];
}

export interface ConflictEdge {
  u: number;
  v: number;
  movement_u: string;
  movement_v: string;
  name_u: string;
  name_v: string;
  J_coeff: number;
}

export interface CircuitLayer {
  name: string;
  type: 'hadamard' | 'rz_local' | 'zz_couplings' | 'rx_mixer' | 'measurement';
  description: string;
  gates_count: number;
  gamma_index?: number;
  beta_index?: number;
  edges_count?: number;
  qubits?: number[];
}

export interface QuantumCircuitInfo {
  p: number;
  num_qubits: number;
  num_clbits: number;
  depth: number;
  total_gates: number;
  gate_counts: Record<string, number>;
  penalty_p: number;
  constant_offset: number;
  qubits: QubitMeta[];
  conflict_edges: ConflictEdge[];
  layers: CircuitLayer[];
  ascii_diagram: string;
  qasm: string;
  exact_optimum: {
    active_movements: string[];
    reward: number;
    qubo_energy: number;
    bitstring: string;
    runtime_ms: number;
  };
}

export interface SampledBitstring {
  bitstring: string;
  raw_qiskit: string;
  active_movements: string[];
  count: number;
  probability: number;
  feasible: boolean;
  violations: [string, string][];
  reward: number;
  qubo_energy: number;
}

export interface QuantumSimulateResult {
  shots: number;
  runtime_ms: number;
  feasible_shots: number;
  valid_sample_rate: number;
  unique_bitstrings: number;
  best_feasible_sample: {
    bitstring: string;
    active_movements: string[];
    reward: number;
    qubo_energy: number;
    count: number;
    probability: number;
  } | null;
  exact_optimum_reward: number;
  approximation_ratio: number | null;
  top_samples: SampledBitstring[];
}

