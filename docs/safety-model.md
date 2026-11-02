# GREEN-WAVE Deterministic Safety Controller Model

## 1. Safety Boundary Principle
The optimizer (whether QAOA or classical heuristic) only proposes candidate movement sets. The independent safety controller validates and enforces all signal transitions.

```text
[ Optimizer Proposal ]
         │
         ▼
[ Independent Feasibility Check ] ──(Conflict detected)──► [ Safe Fallback (argmax w_i) ]
         │ (Feasible)                                                    │
         └───────────────────────────────┬───────────────────────────────┘
                                         ▼
                           [ State Machine Scheduler ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │ Minimum Green (5s) / Maximum Green (40s)     │
                 │ Yellow Clearance Interval (3s)                │
                 │ All-Red Clearance Interval (2s)               │
                 │ Non-interruptible Pedestrian WALK/Clearance   │
                 │ Emergency Vehicle Safe Boundary Preemption    │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                           [ Safe Actuated Signal Phase ]
```

## 2. Invariants & Rules
1. **Zero Conflicting Green Movements**: Under no circumstances can $(u, v) \in E$ both receive `SignalColor.GREEN`.
2. **Non-Interruptible Pedestrian Protection**: When a pedestrian WALK (7s) or CLEARANCE (8s) interval is active, conflicting vehicle paths are held at RED. An arriving emergency vehicle must wait for the clearance interval to conclude safely before preemption transition.
3. **Yellow & All-Red Enforcement**: Every phase transition passes through 3s YELLOW and 2s ALL-RED to clear the intersection.
4. **Deterministic Fallback**: If QAOA produces an infeasible sample, times out, or crashes, the highest priority movement and its mutually compatible right turns are deterministically scheduled.

