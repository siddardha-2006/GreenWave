# GREEN-WAVE System Architecture

## 1. Overview
GREEN-WAVE is a predictive, emergency-aware, and pedestrian-safe intelligent traffic management platform designed for a 4-way intersection. It evaluates QAOA (Quantum Approximate Optimization Algorithm) on Maximum-Weight Independent Set (MWIS) QUBO instances against classical heuristics and exact solvers.

```text
                     ┌──────────────────────────┐
                     │   React + Vite Dashboard │
                     │ Live schematic / controls│
                     └────────────┬─────────────┘
                                  │ HTTP / WebSocket (/ws)
                     ┌────────────▼─────────────┐
                     │    FastAPI Application   │
                     │ REST API + Background Run│
                     └───────┬─────────┬────────┘
                             │         │
                       ┌─────▼───┐ ┌───▼──────────────┐
                       │ Database│ │   Run Manager    │
                       │ MongoDB │ │ (Simulation loop)│
                       └─────────┘ └───────┬──────────┘
                                           │
                ┌──────────────────────────▼──────────────────────────┐
                │                  Decision Pipeline                  │
                │                                                     │
                │  Queue Predictor (30s/60s EMA & Arrival Rate)       │
                │        ↓                                            │
                │  Priority Weights: w_i = α Q_i + β Q̂_i + γ W_i      │
                │        ↓                                            │
                │  QUBO Formulation & Ising Mapping: H_C              │
                │        ↓                                            │
                │  Solvers: QAOA (Aer) | Exact | Greedy | Annealing   │
                │        ↓                                            │
                │  Independent Feasibility & Safety Validator         │
                │        ↓                                            │
                │  Deterministic Phase Controller & State Machine     │
                └──────────────────────────┬──────────────────────────┘
                                           │
                               ┌───────────▼───────────┐
                               │ Intersection Engine   │
                               │ SUMO TraCI / Discrete │
                               └───────────────────────┘
```

## 2. Strict Separation of Concerns
1. **Optimizer (QAOA / Classical)**: Returns candidate vehicle movement sets based purely on mathematical priority weights and conflict penalties.
2. **Safety Validator**: Independently rejects any candidate that violates the conflict graph $G=(V, E)$ or current safety state.
3. **Phase Scheduler**: Governs minimum green (5s), maximum green (40s), yellow clearance (3s), and all-red clearance (2s).
4. **Pedestrian Controller**: Enforces strictly non-interruptible pedestrian WALK and CLEARANCE intervals.
5. **Emergency Manager**: Requests preemption and executes it at the earliest safe boundary without skipping clearance.
6. **Simulation Adapter**: Applies only safe signal transitions and measures queues and throughput.
7. **Frontend Dashboard**: Observes live simulation telemetry and configures experiments; never commands signal lamps directly.

