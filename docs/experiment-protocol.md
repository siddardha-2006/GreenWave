# GREEN-WAVE Experiment Protocol & Benchmarking

## 1. Benchmarking Rules
To ensure honest, auditable, and scientifically valid evaluation:
1. **Identical Inputs**: All solvers (Exact MWIS, Greedy MWIS, Simulated Annealing, and QAOA) receive identical priority weights $w_i$, identical conflict graph $G=(V, E)$, and identical scenario snapshots.
2. **Fixed Random Seeds**: Experiments use documented random seeds (e.g. 42, 123, 999).
3. **Approximation Ratio**:
   $$\text{Approximation Ratio} = \frac{\text{Candidate Feasible Reward}}{\text{Exact Optimal Reward}}$$
4. **Honest Timing**: QAOA circuit compilation, parameter optimization, sampling, and data transfer times are fully reported without omission.
5. **No Quantum Advantage Claims**: Quantum advantage is not claimed merely because a quantum circuit was executed on Aer. For 12 variables ($2^{12} = 4096$ states), classical exact enumeration is a fast, robust reference.

## 2. Core Metrics
- **Mean & Max Waiting Time (s)**
- **Throughput (vehicles served)**
- **Feasibility Rate (% of valid quantum shots)**
- **Emergency Delay (s)**
- **Pedestrian Wait Time (s)**
- **Fallback Engagement Count**

