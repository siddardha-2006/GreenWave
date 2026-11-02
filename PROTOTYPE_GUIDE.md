# GREEN-WAVE Quantum Circuit Prototype

## Overview
This prototype implements the **MWIS (Maximum-Weight Independent Set) QUBO and QAOA (Quantum Approximate Optimization Algorithm)** for traffic signal control at a 4-way intersection, as specified in `GREEN-WAVE-README.md`.

---

## Architecture & Modules

The code is organized under `backend/app/optimization/`:

| Module | Purpose | README Section |
| :--- | :--- | :--- |
| [`movement_model.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/movement_model.py) | 12 directed movement definitions (M0–M11), traffic state (queue, prediction, waiting time), and priority weights. | Sec 4 & 5 |
| [`conflict_graph.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/conflict_graph.py) | Verified movement conflict graph $G=(V, E)$ (28 conflict edges) with symmetry and invariant validation. | Sec 4 |
| [`qubo.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/qubo.py) | Objective: $E(x) = -\sum_i w_i x_i + P \sum_{(i,j) \in E} x_i x_j$ with conservative penalty $P > \sum_i w_i$. | Sec 5 |
| [`ising.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/ising.py) | Exact conversion to $H_C = \sum_i h_i Z_i + \sum J_{ij} Z_i Z_j$ where $h_i = \frac{w_i}{2} - \frac{P d_i}{4}$, $J_{ij} = \frac{P}{4}$, with constant offset $C$ verification. | Sec 5 |
| [`qaoa_circuit.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/qaoa_circuit.py) | Parameterized Qiskit QAOA circuit: $H^{\otimes n}$, $R_Z(2\gamma h_i)$, $CX \to R_Z(2\gamma J_{ij}) \to CX$, $R_X(2\beta)$, and Qiskit little-endian bitstring decoding. | Sec 5 & 6 |
| [`feasibility.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/feasibility.py) | Independent safety validator (detects conflicting green movements) and deterministic safe fallback mechanism. | Sec 5 & 8 |
| [`exact_solver.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/exact_solver.py) | Classical ground-truth baseline evaluating all $2^{12} = 4096$ bitstrings. | Sec 7 |
| [`greedy_solver.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/greedy_solver.py) | Greedy heuristic baseline sorting candidates by priority weight and eliminating conflicting neighbors. | Sec 7 |
| [`annealing_solver.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/annealing_solver.py) | Classical simulated annealing over the QUBO landscape (Metropolis acceptance, geometric cooling). | Sec 7 |
| [`qaoa_solver.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/qaoa_solver.py) | Hybrid QAOA solver: COBYLA parameter optimizer + Qiskit Aer circuit simulation + valid-sample filtering. | Sec 6 & 13 |
| [`benchmark.py`](file:///c:/Users/ramuk/OneDrive/Documents/GreenWave/backend/app/optimization/benchmark.py) | Multi-solver comparative benchmark runner reporting approximation ratio and timing. | Sec 7 & 21 |

---

## 3D Realistic Simulation & Interactive Dashboard

The frontend includes a full **3D WebGL Realistic Simulation** built with Three.js:
- **Asphalt 4-way intersection** with double yellow center dividers, white dashed lane markings, stop bars, and 4 zebra pedestrian crosswalks.
- **Signal Clearance Timing**: Enforces strict 4.0s Yellow transition and 3.5s All-Red clearance delay before opposing traffic receives green, preventing intersection collision.
- **Dynamic 3D traffic lights** with realistic emissive lenses and point lights that cast dynamic green, yellow, and red lighting onto the road and vehicles.
- **Zero-Collision Straight-Line Vehicle Dynamics**: Vehicles maintain safe headway following distance behind preceding cars and stop line barriers, with fixed travel headings preventing any rotational spinning or crab-walking.
- **Dedicated 3D Emergency Ambulance**: White/red box chassis with front cab, rear medical cabin, dual red and blue 8 Hz emergency strobes, flashing roof lightbar, ground siren pulse ripple, and a floating 3D HUD banner during preemption.
- **Pedestrian figures** crossing the zebra crosswalks during the non-interruptible WALK phase.
- **Interactive Orbit Camera Controls**: Left-click drag to orbit, scroll to zoom, right-click to pan.
- **Camera View Presets**: *Perspective (Isometric)*, *Top-Down (Bird's Eye)*, *Driver View*, *Close-Up*, and *Day/Night Mode toggle*.
- **Robustness & Error Recovery**: Full React `ErrorBoundary` and automatic HTTP polling fallback ensuring the dashboard never crashes into a blank screen.

---

## Running the Demonstration

To run the complete interactive CLI demonstration:
```bash
python demo_quantum_circuit.py
```

### Starting the Full Web Platform:
1. **Start the FastAPI Backend**:
   ```bash
   python run_green_wave.py
   ```
   *(Running on http://127.0.0.1:8000 — Swagger Docs at http://127.0.0.1:8000/docs)*

2. **Start the 3D React Dashboard**:
   ```bash
   cd frontend
   npm run dev
   ```
   *(Open http://localhost:5173 in your browser)*

### What the demo executes:
1. **Movement Registry & Conflict Matrix**: Prints the 12 movements and their conflict degrees.
2. **Traffic State Snapshot**: Simulates queue lengths, predicted queues, and starvation wait times to compute weights $w_i$.
3. **QUBO & Ising Hamiltonian**: Displays local fields $h_i$, couplings $J_{ij}$, penalty $P$, and rigorously proves $E_{\text{QUBO}}(x) \equiv H_C(Z) + C$.
4. **Quantum Circuit**: Generates the 12-qubit parameterized QAOA circuit, reports gate counts and depth, and displays an ASCII circuit diagram.
5. **Multi-Solver Benchmark**: Solves the identical problem with Exact Enumeration, Greedy MWIS, Simulated Annealing, and QAOA ($p=1$ and $p=2$) on Qiskit Aer.
6. **Safety & Fallback Audit**: Proves that the independent safety layer catches conflicting candidates and safely engages fallback.
7. **Traffic Controller Interpretation**: Maps the winning bitstring into human-readable signal phase actions.

---

## Running Unit Tests

Run the complete test suite (13 unit tests across optimization and safety controller):
```bash
python -m unittest discover -s backend/tests -p "test_*.py"
```
All 13 unit tests pass, verifying:
- Movement registry mapping & conflict graph invariants (28 edges, symmetry)
- Mathematical equivalence between QUBO and Ising energies
- Endianness handling for Qiskit measurement bitstrings
- Feasibility validator violation detection and safe fallback
- Exact vs. Greedy vs. Annealing vs. QAOA bounds
- Phase state machine transitions: Yellow clearance (4.0s), All-Red clearance (3.5s)
- Non-interruptible pedestrian clearance protection
- Emergency preemption phase switching and safe recovery

