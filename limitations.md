# Project Limitations & Constraints

[![Status: Research Prototype](https://img.shields.io/badge/Status-Research%20Prototype-orange.svg)](https://github.com/siddardha-2006/GreenWave)
[![Safety: Deterministic Override](https://img.shields.io/badge/Safety-Deterministic%20Override-green.svg)](https://github.com/siddardha-2006/GreenWave)

> **Important Notice:** GREEN-WAVE is an experimental research prototype and decision-support simulation environment. It is **not** a field-certified traffic signal controller (such as NEMA TS2 or 170/2070 systems) and must not be connected directly to real-world intersection signal heads without certified hardware-in-the-loop (HIL) safety fail-safes.

This document outlines the current technical, algorithmic, mathematical, and operational limitations of the GREEN-WAVE system.

---

## 📑 Table of Contents
1. [Quantum Computing & Algorithmic Limitations](#1-quantum-computing--algorithmic-limitations)
2. [Traffic & Network Topology Limitations](#2-traffic--network-topology-limitations)
3. [Predictive Model Limitations](#3-predictive-model-limitations)
4. [Safety, Clearance & Actuation Constraints](#4-safety-clearance--actuation-constraints)
5. [Sensor & Vehicle Dynamics Limitations](#5-sensor--vehicle-dynamics-limitations)
6. [Hardware & Communications Architecture](#6-hardware--communications-architecture)
7. [Limitations Summary & Future Roadmap](#7-limitations-summary--future-roadmap)

---

## 1. Quantum Computing & Algorithmic Limitations

### 1.1 Quantum Simulation vs. Physical Quantum Processors (NISQ)
- **Classical Emulation**: The current system executes QAOA circuits using the **Qiskit Aer** statevector and shot-based simulator on classical CPU hardware. While this provides noise-free state evaluations, it does not encounter the physical challenges of real quantum processing units (QPUs).
- **Decoherence & Gate Errors on Physical QPUs**:
  - The GREEN-WAVE conflict graph contains **28 conflict edges**, translating to **56 CNOT gates per QAOA layer** ($p=1 \implies 56$, $p=2 \implies 112$, $p=3 \implies 168$ CNOTs).
  - On present Noisy Intermediate-Scale Quantum (NISQ) hardware, two-qubit gate error rates ($0.5\% - 1.5\%$) would cause significant state decoherence and fidelity degradation at $p \ge 2$ without quantum error correction.
- **Qubit Connectivity Constraints**: Physical QPUs feature restricted planar coupling topologies (e.g., heavy-hex or grid graphs). Mapping the 28 arbitrary conflict edges across 12 qubits would require extensive SWAP-gate insertion, significantly increasing circuit depth.

### 1.2 Infeasible Bitstrings & The Standard X-Mixer
- **State Space Exploration**: GREEN-WAVE implements standard QAOA with a transverse-field mixer $H_M = \sum_i X_i$. 
- **Non-Preservation of Constraints**: The standard X-mixer flips qubits indiscriminately and does not restrict exploration to the subspace of independent sets. Consequently, a portion of measured quantum shots represent infeasible combinations (conflicting green signals).
- **Post-Measurement Filtering Dependency**: The system relies on classical post-processing to filter out infeasible bitstrings and select the best valid sample, or revert to a classical fallback policy if no valid candidate is measured.

### 1.3 Classical Parameter Optimization & Barren Plateaus
- **COBYLA Latency**: QAOA relies on a hybrid loop where classical optimizers (COBYLA) tune variational parameters $(\boldsymbol{\gamma}, \boldsymbol{\beta})$.
- **Scaling Complexity**: While $p=1$ optimizes in $\mathbb{R}^2$ rapidly ($\approx 10\text{ms}$), $p=3$ requires searching $\mathbb{R}^6$ ($\approx 70-160\text{ms}$), increasing computational latency that can become a bottleneck under high-frequency decision cycles.
- **Barren Plateaus & Local Optima**: As problem sizes or layers scale, variational quantum algorithms risk encountering barren plateaus (exponentially vanishing gradients) or trapping in suboptimal local minima.

---

## 2. Traffic & Network Topology Limitations

### 2.1 Single Isolated Intersection Scope
- **No Arterial Coordination ("Green Wave")**: The current release models a single, isolated 4-way intersection. It does not yet coordinate phase offsets or establish progressive green corridors across multi-intersection arterial networks.
- **Boundary Boundary Effects**: Inflow and outflow assume infinite downstream sink capacity without modeling queue spillbacks from downstream intersections.

### 2.2 Rigid Geometric Topology
- **Fixed 12-Movement NEMA Configuration**: The movement model strictly assumes a symmetrical 4-way junction with 3 incoming lanes per approach (Left, Through, Right):
  - North: `M0` (T), `M1` (L), `M2` (R)
  - South: `M3` (T), `M5` (L), `M4` (R)
  - East: `M6` (T), `M8` (L), `M7` (R)
  - West: `M9` (T), `M10` (L), `M11` (R)
- **Unsupported Geometries**: It does not support 3-way (T-junctions), 5-way intersections, roundabouts, channelized slip lanes, or diagonal approaches without manual conflict graph reconfiguration.

---

## 3. Predictive Model Limitations

### 3.1 Statistical Trend vs. Deep Spatiotemporal Models
- **Linear Horizon Assumption**: The current `BaselinePredictor` uses an Exponential Moving Average (EMA) and linear net arrival velocity ($\Delta Q / \Delta t$) to project demand at $30\text{s}$ and $60\text{s}$.
- **Lack of Exogenous Features**: The predictor does not account for weather conditions, downstream bottlenecks, special events, or time-of-day historical profiles.
- **Shockwave Blindness**: If an abrupt platoon of vehicles arrives from an upstream signal release, the linear trend predictor cannot anticipate it until the vehicles physically enter the approach detection zone.

---

## 4. Safety, Clearance & Actuation Constraints

### 4.1 Discrete-Epoch Decision Windows
- **Fixed 5-Second Decision Epochs**: The optimizer re-evaluates signal choices every $5.0\text{s}$. 
- **Lack of Actuated Gap-Out**: Real-world field controllers monitor vehicle headways in real time (e.g., $0.1\text{s}$ resolution) to "gap out" a green phase the moment demand lapses. GREEN-WAVE currently holds phases for fixed discrete intervals before re-optimizing.

### 4.2 Static Safety Clearance Envelopes
- **Constant Clearance Intervals**: The safety controller enforces hardcoded intervals:
  - Minimum Green: $5.0\text{s}$
  - Yellow Change: $3.0\text{s}$
  - All-Red Clearance: $2.0\text{s}$
- **Speed Inelasticity**: In real-world engineering, yellow and all-red clearance intervals are calculated based on approach speed limits and intersection width (ITE formula). The current implementation uses uniform static durations across all approaches.

---

## 5. Sensor & Vehicle Dynamics Limitations

### 5.1 Simulated Poisson Inflow vs. Real Field Telemetry
- **Homogeneous Flow**: Vehicle arrivals are generated via synthetic Poisson processes. Real traffic manifests correlated, non-Poisson arrivals characterized by platooning, driver reaction variability, and micro-surges.
- **Absence of Real Sensor Interfaces**: The current deployment relies on simulator state queries rather than physical sensor ingestion pipelines (e.g., inductive loops, radar detectors, video camera feeds, or V2X BSM broadcasts).

### 5.2 Microscopic Vehicle Dynamics & Modal Diversity
- **Simplified Car-Following**: While the 3D visualizer features collision-free forward radar and continuous Bézier turning curves, it uses an idealized kinematic acceleration model rather than fully calibrated microscopic behavioral models (such as the Intelligent Driver Model (IDM) or Wiedemann 99 psycho-physical model).
- **Homogeneous Traffic Mix**: The simulation models standard passenger cars and ambulances, but omits:
  - Heavy freight trucks (with extended braking distances and slower acceleration).
  - Bicycles, e-scooters, and vulnerable road users.
  - Multi-lane weaving and opportunistic lane-changing maneuvers.

---

## 6. Hardware & Communications Architecture

### 6.1 Web-Stack Protocols vs. Industrial Fieldbuses
- **WebSocket & HTTP Polling**: Live telemetry and overrides use standard WebSockets and HTTP REST APIs. While suitable for web interfaces and remote monitoring, these protocols are non-deterministic.
- **Lack of Industrial Standards**: Real-world Advanced Transportation Controllers (ATC) require hard-real-time fieldbus protocols such as **NTCIP 1202**, **CAN bus**, or **Ethernet/IP** with sub-millisecond deterministic guarantees.

---

## 7. Limitations Summary & Future Roadmap

| Domain | Current Limitation | Practical Impact | Planned Mitigation / Roadmap |
| :--- | :--- | :--- | :--- |
| **Quantum** | Standard $X$-mixer produces infeasible states | Requires classical filtering & fallbacks | Constrained XY mixer Hamiltonian preserving independent sets |
| **Hardware** | Classical Aer simulation | Not tested against physical QPU noise | Execution on physical IBM Quantum hardware via Qiskit Runtime |
| **Network** | Isolated single 4-way intersection | Cannot coordinate green corridors | Distributed multi-agent MWIS with inter-junction coordination |
| **Topology** | Rigid 12-movement layout | Incompatible with irregular junctions | Arbitrary graph builder accepting custom geometry inputs |
| **Prediction** | Linear EMA + arrival velocity | Limited foresight for non-linear platoons | Spatial-temporal Graph Neural Network (STGCN) or LSTM |
| **Actuation** | Discrete 5s optimization steps | May hold green longer than necessary | Continuous actuation with vehicle gap-seeking logic |
| **Vehicle Mix**| Passenger cars & ambulances only | Lacks commercial vehicles and bikes | Multi-class vehicle fleet dynamics with variable physical profiles |
| **Standards** | WebSocket / JSON API | Cannot interface with real traffic cabinets | NTCIP 1202 protocol compliance layer |

