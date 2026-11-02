# GREEN-WAVE Master Prompt Engineering Book

[![Status: Production Ready](https://img.shields.io/badge/Status-Complete%20Prompt%20Guide-blue.svg)](https://github.com/siddardha-2006/GreenWave)
[![Project: GREEN-WAVE](https://img.shields.io/badge/Project-GREEN--WAVE-green.svg)](https://github.com/siddardha-2006/GreenWave)

This document contains the complete, structured sequence of engineering prompts used to design, develop, test, visualize, and deploy the **GREEN-WAVE** platform from scratch. 

You can use these prompts with AI coding assistants (such as Antigravity, Claude, ChatGPT, or Cursor) to reproduce, extend, or teach the complete architecture.

---

## 📑 Table of Contents
1. [System Persona & Global Context Prompt](#1-system-persona--global-context-prompt)
2. [Phase 1: Project Scaffolding & Environment Setup](#phase-1-project-scaffolding--environment-setup)
3. [Phase 2: Mathematical Movement & Conflict Graph Modeling](#phase-2-mathematical-movement--conflict-graph-modeling)
4. [Phase 3: QUBO Formulation & Ising Hamiltonian Mapping](#phase-3-qubo-formulation--ising-hamiltonian-mapping)
5. [Phase 4: Quantum Computing Core (QAOA with Qiskit)](#phase-4-quantum-computing-core-qaoa-with-qiskit)
6. [Phase 5: Classical Benchmark Solvers (Exact, Greedy, Annealing)](#phase-5-classical-benchmark-solvers-exact-greedy-annealing)
7. [Phase 6: Online Predictive Traffic Model (Sliding-Window EMA)](#phase-6-online-predictive-traffic-model-sliding-window-ema)
8. [Phase 7: Deterministic Safety Controller & Preemption Engine](#phase-7-deterministic-safety-controller--preemption-engine)
9. [Phase 8: Discrete-Event Traffic Simulator & Scenarios](#phase-8-discrete-event-traffic-simulator--scenarios)
10. [Phase 9: FastAPI Backend, WebSocket Telemetry & Persistence](#phase-9-fastapi-backend-websocket-telemetry--persistence)
11. [Phase 10: Relevo & Vinco Tactile UI Design System](#phase-10-relevo--vinco-tactile-ui-design-system)
12. [Phase 11: 3D Spatial Digital Twin & Intersection Physics (Three.js)](#phase-11-3d-spatial-digital-twin--intersection-physics-threejs)
13. [Phase 12: Interactive 3D Quantum Circuit Visualizer](#phase-12-interactive-3d-quantum-circuit-visualizer)
14. [Phase 13: Packaging, Docker Multi-Stage Build & Production Deployment](#phase-13-packaging-docker-multi-stage-build--production-deployment)

---

## 1. System Persona & Global Context Prompt

Use this prompt at the start of any new session to ground the AI in the domain, rules, and mathematical principles:

```text
You are an expert Quantum Computing Engineer, Distributed Systems Architect, and Autonomous Traffic Systems Specialist. 
We are building GREEN-WAVE: an intelligent traffic signal optimization and decision-support platform that solves multi-corridor intersection scheduling as a Maximum-Weight Independent Set (MWIS) problem using QUBO and the Quantum Approximate Optimization Algorithm (QAOA) in Qiskit.

Core Architectural Invariants:
1. Two-Tier Control: Probabilistic quantum optimization (QAOA/QUBO) only proposes candidate green movement sets. A separate deterministic safety controller validates and enforces all physical transitions (min green 5s, yellow 3s, all-red 2s, pedestrian clearance, and emergency vehicle preemption). QAOA NEVER directly actuates signal heads.
2. 12-Movement Conflict Graph: Standard 4-way NEMA intersection with 12 movements (M0 to M11) across North, South, East, and West approaches. Mutually colliding trajectories form 28 conflict edges.
3. Predictive Weighting: Movement priority weights combine live queues (Q), 30s projected arrivals (Q_pred via sliding-window EMA), and longest vehicle wait times (W): w_i = alpha*Q_i + beta*Q_pred_i + gamma*W_i.
4. Classical Benchmark Baseline: Every quantum decision must be empirically benchmarked against Exact Brute-Force MWIS, Greedy MWIS, and Simulated Annealing to log approximation ratios, valid sample rates, and runtime latency.
5. High-Fidelity 3D Digital Twin: The system includes a photorealistic Three.js 3D simulation with independent 3-head gantries, 100% collision-free forward radar car-following, continuous Bézier turn trajectories, dedicated emergency ambulance lighting, and an autonomous anti-deadlock watchdog.
6. Design Aesthetic: The frontend follows the tactile "Relevo & Vinco" industrial luxury engineering style (pressed metal plates, debossed wells, bronze/brass accents #c99a5b, deep obsidian background, mono typography).
```

---

## Phase 1: Project Scaffolding & Environment Setup

### Prompt 1.1: Full-Stack Project Skeleton & Dependencies
```text
Create the directory structure and configuration files for a full-stack monorepo named GREEN-WAVE.

Requirements:
1. Backend: Python 3.11+ using FastAPI, Uvicorn, Qiskit 1.0+, Qiskit Aer, NumPy, SciPy, Pydantic v2, and PyMongo.
   Create directory: backend/app/ with subpackages:
   - api/ (REST routes & WebSockets)
   - core/ (config & settings)
   - db/ (persistence & in-memory fallback)
   - optimization/ (QUBO, Ising, QAOA, classical solvers)
   - prediction/ (traffic predictor)
   - safety/ (deterministic state machine)
   - schemas/ (Pydantic models)
   - services/ (RunManager background threads)
   - simulation/ (discrete-event traffic engine)
   Also create backend/tests/ for unit testing.
2. Frontend: React 18, TypeScript, Vite 5, Tailwind CSS 3.4, Three.js (r128+), and Lucide React.
   Create directory: frontend/src/ with components/, types/, index.css, and App.tsx.
3. Configuration Files:
   - requirements.txt listing all backend dependencies with version constraints.
   - frontend/package.json with React, Three.js, Tailwind, and Vite.
   - frontend/vite.config.ts configured with dev proxy forwarding /api and /ws to http://127.0.0.1:8000.
   - frontend/tailwind.config.js with custom colors (#c99a5b brass, #161513 obsidian, #2eb872 signal green, #d99b26 signal amber, #cf4338 signal red).
   - run.py launcher script to start FastAPI with backend in python sys.path.
   - .env.example with API_HOST, API_PORT, MONGODB_URI, and decision intervals.
```

---

## Phase 2: Mathematical Movement & Conflict Graph Modeling

### Prompt 2.1: 12-Movement Registry & Priority Weight Calculator
```text
Write the movement registry and weight calculation module in backend/app/optimization/movement_model.py.

Requirements:
1. Define a Movement dataclass with:
   - id: str ('M0' through 'M11')
   - index: int (0 to 11)
   - approach: 'North' | 'South' | 'East' | 'West'
   - exit: 'North' | 'South' | 'East' | 'West'
   - movement_type: 'through' | 'left' | 'right'
   - description: str
2. Standard NEMA 12 movements mapping:
   - North: M0 (Through -> South), M1 (Left -> East), M2 (Right -> West)
   - South: M3 (Through -> North), M4 (Right -> East), M5 (Left -> West)
   - East:  M6 (Through -> West),  M7 (Right -> North), M8 (Left -> South)
   - West:  M9 (Through -> East),  M10 (Left -> North), M11 (Right -> South)
3. TrafficState dataclass tracking:
   - queue_lengths: Dict[str, float]
   - predicted_queues: Dict[str, float]
   - waiting_times: Dict[str, float]
4. Function calculate_weights(traffic_state, registry, alpha=1.0, beta=0.5, gamma=0.3, min_weight=0.1) -> np.ndarray:
   Calculates priority weights w_i = max(alpha * Q_i + beta * Q_hat_i + gamma * W_i, min_weight) for all 12 movements.
```

### Prompt 2.2: 28-Edge Intersection Conflict Graph
```text
Implement backend/app/optimization/conflict_graph.py modeling mutual traffic conflicts.

Requirements:
1. ConflictGraph class storing num_nodes (12) and an adjacency matrix / edge set.
2. Methods: add_edge(u, v), has_conflict(u, v), get_conflicts(node), get_edges().
3. Function create_default_conflict_graph() implementing the exact 28 collision pairs:
   - Through vs Through: (M0, M6), (M0, M9), (M3, M6), (M3, M9)
   - Through vs Left: (M0, M8), (M0, M10), (M0, M5), (M3, M8), (M3, M10), (M3, M1), (M6, M1), (M6, M5), (M6, M10), (M9, M1), (M9, M5), (M9, M8)
   - Left vs Left: (M1, M8), (M1, M10), (M5, M8), (M5, M10)
   - Right vs Left: (M1, M7), (M5, M2), (M8, M11), (M10, M4)
   - Right vs Through: (M2, M6), (M4, M9), (M7, M3), (M11, M0)
4. Verify symmetric properties and ensure non-conflicting pairs (e.g., dual throughs M0 & M3, or dual lefts M1 & M5) do not have edges.
```

---

## Phase 3: QUBO Formulation & Ising Hamiltonian Mapping

### Prompt 3.1: QUBO Matrix & Penalty Constructor
```text
Implement backend/app/optimization/qubo.py constructing the QUBO matrix for Maximum-Weight Independent Set.

Requirements:
1. QUBOFormulation class taking weights (np.ndarray of length 12) and a ConflictGraph.
2. Objective formulation:
   E(x) = - sum_i (w_i * x_i) + P * sum_{(i,j) in E} (x_i * x_j)
   where x_i in {0, 1}.
3. Penalty calculation:
   Ensure conservative penalty P > sum_i w_i (set penalty_p = max(sum_w * 1.5, 1.0)).
4. Matrix construction:
   Construct upper-triangular Q in R^{12x12}:
   - Q[i, i] = -w_i
   - Q[u, v] = P for all edges (u, v) in E with u < v.
5. Evaluation methods:
   - evaluate_energy(x: np.ndarray) -> float: computes E(x) = -w.x + P * sum(x_u * x_v).
   - evaluate_reward(x: np.ndarray) -> float: computes original MWIS reward w.x (penalty-free).
```

### Prompt 3.2: QUBO-to-Ising Hamiltonian Transformation
```text
Implement backend/app/optimization/ising.py converting the QUBO model into an Ising spin Hamiltonian for quantum simulation.

Requirements:
1. Apply the variable substitution x_i = (1 - Z_i) / 2 where Z_i in {+1, -1}.
2. Derive and compute:
   - Single-qubit linear coefficients h_i for Pauli-Z:
     h_i = (w_i / 2.0) - (P / 4.0) * degree(i)
   - Two-qubit quadratic interaction coefficients J_{ij} for Z_i Z_j:
     J_{ij} = P / 4.0 for all (i, j) in E
   - Constant energy offset C:
     C = - sum_i (w_i / 2.0) + (P / 4.0) * |E|
3. Provide evaluate_energy(z: np.ndarray) -> float verifying that E_ising(z) + C equals E_qubo(x).
```

---

## Phase 4: Quantum Computing Core (QAOA with Qiskit)

### Prompt 4.1: Parametric QAOA Circuit Builder
```text
Implement backend/app/optimization/qaoa_circuit.py building the parameterized Qiskit quantum circuit.

Requirements:
1. QAOAQuantumCircuit class accepting an IsingHamiltonian and depth p (1, 2, or 3).
2. Circuit Architecture:
   - QuantumRegister of 12 qubits, ClassicalRegister of 12 bits.
   - Initial state: Apply Hadamard gate (H) to all 12 qubits to create uniform superposition |+>^{otimes 12}.
   - For layer l = 1..p:
     a) Cost Unitary U_C(gamma_l) = e^{-i * gamma_l * H_C}:
        - Single-qubit rotations: RZ(2 * gamma_l * h_i) on each qubit i.
        - Two-qubit entangling gates for each conflict edge (u, v) in E:
          CX(u, v) -> RZ(2 * gamma_l * J_uv, v) -> CX(u, v).
     b) Mixer Unitary U_M(beta_l) = e^{-i * beta_l * H_M}:
        - RX(2 * beta_l) on each qubit i.
   - Measurement: Measure all 12 qubits to classical register.
3. ParameterVectors:
   Use Qiskit ParameterVector('gamma', p) and ParameterVector('beta', p).
4. Provide methods:
   - build_parameterized_circuit(measure=True)
   - build_bound_circuit(gammas, betas, measure=True)
   - decode_bitstring(raw_bitstring, num_qubits) taking into account Qiskit's little-endian bitstring ordering.
```

### Prompt 4.2: QAOA Classical-Quantum Optimization Loop
```text
Implement backend/app/optimization/qaoa_solver.py executing QAOA on Qiskit Aer with classical parameter optimization.

Requirements:
1. QAOASolver class with parameters: qubo, conflict_graph, p=1, shots=2048, maxiter=50, optimizer_name='COBYLA', seed=42.
2. Classical outer-loop optimization:
   - Objective function: Compute expected energy <psi(gamma, beta)| H_C |psi(gamma, beta)> using Qiskit Aer statevector simulation for clean, noise-free gradient evaluations.
   - Optimize parameters [gamma_1..p, beta_1..p] using scipy.optimize.minimize(method='COBYLA').
3. Quantum measurement sampling:
   - Bind optimal angles to the circuit and execute on AerSimulator with configured shot count (2048).
   - Collect measurement counts.
4. Feasibility filtering & Fallback policy:
   - Decode each measured bitstring and check against conflict_graph.
   - Discard infeasible samples containing conflict edges.
   - Calculate valid_sample_rate = (feasible shots) / (total shots).
   - If feasible samples exist, select the bitstring maximizing the original reward sum_i w_i * x_i.
   - If no feasible bitstring was sampled, invoke a safe classical greedy fallback policy and mark fallback_used=True.
5. Return SolverResult dataclass containing: solver name, bitstring, active_movements, objective_reward, qubo_energy, feasible, valid_sample_rate, runtime_ms, fallback_used, and approximation_ratio.
```

---

## Phase 5: Classical Benchmark Solvers (Exact, Greedy, Annealing)

### Prompt 5.1: Classical Baseline Solvers Suite
```text
Implement the classical comparison solvers in backend/app/optimization/:
1. exact_solver.py (ExactMWISSolver):
   - Exhaustively enumerates all 2^12 = 4,096 bitstrings.
   - Checks feasibility against conflict_graph.
   - Computes exact optimum reward w* = max_{x feasible} sum_i w_i * x_i.
   - Serves as the ground truth benchmark for computing QAOA's approximation ratio: approx_ratio = reward / w*.
2. greedy_solver.py (GreedyMWISSolver):
   - Sorts movements descending by weight w_i.
   - Iteratively adds movements to the active set if they do not conflict with already selected movements.
3. annealing_solver.py (SimulatedAnnealingSolver):
   - Implements Metropolis-Hastings Markov chain Monte Carlo on {0, 1}^12.
   - Temperature geometric cooling schedule: T_{k+1} = T_k * cooling_rate.
   - Flips single bits, accepting energy changes delta_E < 0 or with probability exp(-delta_E / T).
```

---

## Phase 6: Online Predictive Traffic Model (Sliding-Window EMA)

### Prompt 6.1: Queue Predictor & Trend Estimator
```text
Implement backend/app/prediction/baseline_predictor.py providing real-time queue forecasting.

Requirements:
1. BaselinePredictor class with rolling window_size=30, ema_alpha=0.3, primary_horizon=30.0, secondary_horizon=60.0.
2. For each of the 12 movements, maintain:
   - A bounded chronological queue: deque(maxlen=30) storing (timestamp, queue_length).
   - An Exponential Moving Average (EMA) queue value:
     EMA_t = alpha * Q_t + (1 - alpha) * EMA_{t-1}
   - Estimated arrival velocity (rate):
     Rate = max(0, Q_now - Q_old) / max(t_now - t_old, 1.0)  [veh/s]
3. Method update(simulation_time, current_queues): updates history, EMA, and arrival rate on every tick.
4. Method predict(horizon=30.0) -> Dict[str, float]:
   Calculates projected queue:
   Q_pred = max(0.0, EMA + Rate * horizon)
5. Method get_full_predictions() returning a PredictionSnapshot for both 30s and 60s horizons.
```

---

## Phase 7: Deterministic Safety Controller & Preemption Engine

### Prompt 7.1: Deterministic Signal State Machine & Clearance Rules
```text
Implement backend/app/safety/controller.py and phase_model.py.

Requirements:
1. Define PhaseType enum:
   - ALL_RED (clearance)
   - VEHICLE_GREEN (active movement service)
   - VEHICLE_YELLOW (stopping change interval)
   - PEDESTRIAN_WALK (crosswalk walk interval)
   - PEDESTRIAN_CLEARANCE (flashing hand)
   - EMERGENCY_PREEMPTION (corridor priority lock)
2. Timing Configuration:
   - min_green: 5.0s
   - yellow_duration: 3.0s
   - all_red_duration: 2.0s
   - max_green: 45.0s
   - pedestrian_walk: 7.0s, pedestrian_clearance: 4.0s
3. Safety Invariants:
   - Feasibility Check: Check candidate movements against conflict_graph. If any conflict exists, reject immediately and substitute with safe fallback phase.
   - Transition Enforcement: Before activating any new conflicting green phase, the current phase MUST transition through Yellow (3.0s) followed by All-Red (2.0s). Green signals can NEVER immediately switch between conflicting corridors.
4. Preemption & Pedestrian Logic:
   - request_emergency_preemption(movement_id): Immediately forces conflicting active green signals to yellow, transitions to all-red, and grants exclusive green to the ambulance corridor until cleared.
   - request_pedestrian_crossing(approach): Schedules pedestrian walk/clearance phase, holding all vehicle movements that cross the requested crosswalk.
5. Provide get_signal_colors() returning Dict[mId, 'green' | 'yellow' | 'red'].
```

---

## Phase 8: Discrete-Event Traffic Simulator & Scenarios

### Prompt 8.1: Traffic Dynamics Simulator & Demand Scenarios
```text
Implement backend/app/simulation/simulator.py and scenarios.py.

Requirements:
1. IntersectionSimulator class:
   - Maintains current_time, total_throughput, and vehicle arrival queues _queues[m_id] storing arrival timestamps.
   - step(signal_colors, pedestrian_state, emergency_state, dt=1.0):
     a) Poisson Arrivals: arrivals ~ Poisson(effective_arrival_rate * dt), appended to _queues[m_id].
     b) Binomial Saturation Flow Discharge: When signal_colors[m_id] == 'green', discharge vehicles with rate 0.55 veh/s: discharges ~ Binomial(len(queue), min(0.55 * dt, 1.0)). Remove discharged vehicles and increment total_throughput.
   - get_traffic_state(): returns current queue lengths and waiting time of the oldest vehicle in each queue.
   - get_metrics_snapshot(): computes mean wait time, max wait time, throughput, queue lengths, signal colors, and emergency delays.
2. Available Scenarios in scenarios.py:
   - balanced_peak: Symmetrical high demand on all approaches.
   - one_direction_heavy: Heavy commuter traffic along North-South with light East-West.
   - sudden_surge: Baseline traffic with a scheduled 2.0x surge event at t=60s.
   - emergency_priority: Dispatches an emergency ambulance on M0 at t=30s.
   - pedestrian_rush: High pedestrian crossing calls on North and East crosswalks.
```

---

## Phase 9: FastAPI Backend, WebSocket Telemetry & Persistence

### Prompt 9.1: Background Orchestrator, REST APIs & Live WebSockets
```text
Implement backend/app/services/run_manager.py, api/routes.py, and main.py.

Requirements:
1. RunManager Service:
   - Manages simulation background threads.
   - Runs simulation loop at paced 80ms sleep ticks (1.0s simulation time per tick).
   - Every 5.0s (decision interval): queries predictor for Q_pred, computes priority weights, runs the configured solver (QAOA / Exact / Greedy / SA), passes candidate movements to the SafetyController, steps simulator, and logs solver benchmarks.
   - Streams live JSON telemetry payloads over WebSockets via threadsafe loop dispatch.
2. REST Endpoints in routes.py:
   - GET /api/scenarios: returns available traffic scenarios.
   - POST /api/experiments: creates experiment with selected scenario, solver, and QAOA config.
   - POST /api/experiments/{id}/start: starts simulation thread.
   - POST /api/experiments/{id}/stop: graceful stop.
   - POST /api/experiments/{id}/inject-pedestrian: triggers pedestrian crossing.
   - POST /api/experiments/{id}/inject-emergency: dispatches ambulance.
   - GET /api/experiments/{id}/solvers: returns decision audit log ledger.
   - GET /api/quantum/circuit?p=1: returns Qiskit circuit metadata and ASCII diagram text.
   - GET /health: health check endpoint.
   - WebSocket /ws/experiments/{id}: streams real-time telemetry.
3. In main.py:
   - Check if frontend/dist exists; if present, mount StaticFiles at / so FastAPI serves the compiled React app on port 8000.
```

---

## Phase 10: Relevo & Vinco Tactile UI Design System

### Prompt 10.1: Design Tokens & Layout Architecture
```text
Design the user interface in frontend/src/ following the tactile "Relevo & Vinco" industrial luxury aesthetic.

Design Rules:
1. Theme & Color Palette:
   - Background: Deep obsidian/charcoal (#0f0e0d, #141311).
   - Surfaces: Multi-layer embossed plates (#1a1916) with subtle drop shadows and border highlights (#2b2824).
   - Wells: Debossed pressed wells (#12110f) for input fields, tables, and canvases.
   - Accents: Aged brass/gold (#c99a5b) for section markers and technical headers; warm cream (#f5f2eb) for primary text; muted stone (#8a8070) for labels.
   - Traffic Colors: Signal Green (#2eb872), Signal Amber (#d99b26), Emergency Red (#cf4338).
   - Typography: Clean serif for display titles, tabular monospace for numbers, counters, and technical timestamps.
   - Corner Crop Marks: Technical drafting corner tick marks (⌜, ⌝) on cards.
2. Layout Components in frontend/src/components/:
   - ExperimentControls.tsx: Run identifier input, scenario dropdown, solver engine selector (QAOA, Exact, Greedy, SA), QAOA depth selector (p=1, p=2, p=3), seed input, and emergency/pedestrian injection buttons.
   - TelemetryCharts.tsx: 4 pressed letterpress KPI gauges (Mean Wait, Total Queue, Throughput, Priority Delay) and 12 individual corridor demand bars (M00 to M11) showing live queue counts and signal indicators.
   - IntersectionView.tsx: 2D technical junction schematic with live signal circles and queue count badges (e.g. "M0 (T) 4q").
   - SolverAuditPanel.tsx: Decision Audit Log table displaying timestamps, active solvers, independent movement sets, MWIS rewards, feasibility badges, and runtime latencies.
```

---

## Phase 11: 3D Spatial Digital Twin & Intersection Physics (Three.js)

### Prompt 11.1: Photorealistic 3D Intersection & Vehicle Dynamics
```text
Implement frontend/src/components/Realistic3DIntersection.tsx rendering a full 3D digital twin of the intersection using Three.js.

Requirements:
1. 3D Environment:
   - Asphalt 4-way cross roads (24m wide) with sidewalk curbs.
   - Road markings: double-yellow center dividers, white stop bars at distance=15m, and striped zebra crosswalks.
   - Directional sunlight with PCFSoftShadowMap and ambient day/night toggles.
2. Overhead Traffic Signal Gantries:
   - 4 gantry posts (one on each corner).
   - Spanning horizontal gantry arm across incoming lanes.
   - CRITICAL FIX: Mount 3 independent 3-head signal assemblies along each arm (one dedicated head over Right lane, Through lane, and Left lane) with independent materials and dynamic point lights so movements never overwrite each other's signal colors.
3. Realistic Vehicle Models & Trajectories:
   - Procedural automotive models (Sedan, SUV, Sports car) with chassis, glass windshield, headlights, brake lights, rotating wheels, steerable front wheel pivots, and amber turn signals.
   - Dedicated Ambulance model: Rooftop lightbar with alternating bright red and blue strobe lights (8Hz), siren ground ripple pulse, and rooftop tag.
   - Continuous cubic Bézier trajectories for all 12 movements (M0 to M11) through the junction.
4. 100% Collision-Free Physics:
   - Lead vehicle car-following queue buffer.
   - Stop line holding on red/yellow.
   - Unprotected left-turn yield to oncoming through traffic: ONLY yield if oncoming traffic is in the box or approaching on green and moving (ignore cars stopped at red).
   - "Do Not Block the Box" clearance: scope strictly to vehicles inside the conflict box (-11m to +12m).
   - Universal 3D Forward Radar: vector projection along travel corridor ignoring cars in adjacent parallel approach lanes.
   - Autonomous Anti-Deadlock Watchdog: if a car is stopped >4.0s on green or inside an intersection turn pocket with a clear forward gap (>4.5m), automatically disengage yield locks and creep forward at 3.5m/s.
5. Camera Controls:
   - OrbitControls with 4 preset buttons: Perspective (isometric), Top-Down (bird's-eye 2D), Driver POV, and Close-Up.
```

---

## Phase 12: Interactive 3D Quantum Circuit Visualizer

### Prompt 12.1: 3D Quantum Waveguide Circuit Visualizer
```text
Implement frontend/src/components/QuantumCircuitVisualizer.tsx displaying the QAOA quantum circuit.

Requirements:
1. Clean Two-Option Tabbed Layout:
   - Tab 1: "3D Quantum Circuit (Waveguide Ansätz)"
   - Tab 2: "Qiskit ASCII Diagram"
   (Remove all external walkthroughs, sandboxes, and unnecessary sub-decks).
2. 3D Circuit Canvas (Three.js):
   - 12 horizontal quantum waveguide rails representing qubits 0 to 11.
   - Visual gates along the rails:
     a) Hadamard Layer: Gold cubes labeled 'H'.
     b) RZ Phase Shift Layer: Amber cylinders labeled 'RZ(2γh_i)'.
     c) 28 Spatial ZZ Entangling Arches: Glowing bezier 3D arches connecting conflicting qubit pairs with mid-point interaction nodes.
     d) RX Mixer Layer: Cyan cylinders labeled 'RX(2β)'.
     e) Measurement Layer: Dark terminal blocks with meter icons.
   - Animated glowing energy wavepackets propagating along the waveguides.
   - OrbitControls allowing interactive 3D rotation, inspection, and hover tooltips detailing gate parameters.
3. Qiskit ASCII Diagram Tab:
   - Monospace, retro-terminal debossed viewer rendering the authentic Qiskit text-circuit diagram (showing wires, H, Rz, cx, rx, and measurement barriers).
   - Fetch circuit metadata dynamically from GET /api/quantum/circuit?p={p}.
```

---

## Phase 13: Packaging, Docker Multi-Stage Build & Production Deployment

### Prompt 13.1: Multi-Stage Dockerfile & Orchestration
```text
Create the production deployment assets:
1. Multi-Stage Dockerfile:
   - Stage 1 (frontend-builder): node:20-alpine. Copies frontend/, runs npm ci, and executes npm run build to output frontend/dist.
   - Stage 2 (runtime): python:3.11-slim. Installs build-essential, curl, and python dependencies from requirements.txt. Copies backend/, simulation/, run.py, and copies --from=frontend-builder /app/frontend/dist into frontend/dist.
   - Exposes port 8000.
   - Implements healthcheck: curl -f http://localhost:8000/health || exit 1.
   - Entrypoint: python run.py.
2. docker-compose.yml:
   - Service green-wave: builds from Dockerfile, exposes 8000:8000, environment variables APP_ENV=production, API_HOST=0.0.0.0, API_PORT=8000, MONGODB_URI=mongodb://mongodb:27017.
   - Service mongodb: mongo:7 with persistent named volume mongo_data.
3. Write comprehensive documentation in DEPLOYMENT.md and Tech_stack.md explaining deployment options (Docker, Render, Railway, Fly.io, Vercel, and Linux VPS with Nginx reverse proxy and SSL).
```

---

## 🏆 Prompt Execution Order & Validation Checklist

When reproducing the project from scratch, execute the prompts in the following order:

| Step | Target Modules | Key Verification Metric |
| :--- | :--- | :--- |
| **1** | Directory Scaffolding & Configs | `npm run build` & `python run.py` boot cleanly |
| **2** | Movement Model & Conflict Graph | 12 movements registered, exactly 28 conflict pairs |
| **3** | QUBO & Ising Converters | $E_{\text{ising}}(z) + C \equiv E_{\text{qubo}}(x)$ for all states |
| **4** | QAOA Qiskit Circuit & Solvers | Aer simulation returns valid sample rate $> 0$ |
| **5** | Classical Solvers (Exact, Greedy, SA)| Exact solver finds optimum reward on all $2^{12}$ states |
| **6** | Sliding-Window EMA Predictor | Forecasts 30s queue depths with net arrival velocity |
| **7** | Safety State Machine | Enforces $5\text{s}$ min green, $3\text{s}$ yellow, $2\text{s}$ all-red |
| **8** | Discrete-Event Simulator | Poisson arrivals match scenario flow rates |
| **9** | FastAPI REST & WebSockets | Telemetry broadcasts at 80ms ticks, Swagger UI at `/docs` |
| **10** | Relevo & Vinco Tactile UI | Dark tactile styling with debossed wells & brass headers |
| **11** | 3D Spatial Intersection (Three.js) | Dedicated 3-head gantries, 0 car crashes, 0 deadlocks |
| **12** | 3D Quantum Circuit Visualizer | Interactive 12-rail 3D waveguide + Qiskit ASCII diagram |
| **13** | Docker Multi-Stage Deployment | Single container on port 8000 serves UI, REST API, & WS |
