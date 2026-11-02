# GREEN-WAVE Movement & Conflict Graph Mapping

## 1. Authoritative 12-Movement Registry
As specified in Section 4 of `GREEN-WAVE-README.md`, the 4-way junction models 12 directed vehicle movements:

| ID | Movement | Approach | Exit Direction | Movement Type | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **M0** | N-S | North | South | Through | North approach to south exit (Through) |
| **M1** | N-E | North | East | Left | North approach to east exit (Left turn) |
| **M2** | N-W | North | West | Right | North approach to west exit (Right turn) |
| **M3** | S-N | South | North | Through | South approach to north exit (Through) |
| **M4** | S-E | South | East | Right | South approach to east exit (Right turn) |
| **M5** | S-W | South | West | Left | South approach to west exit (Left turn) |
| **M6** | E-W | East | West | Through | East approach to west exit (Through) |
| **M7** | E-N | East | North | Right | East approach to north exit (Right turn) |
| **M8** | E-S | East | South | Left | East approach to south exit (Left turn) |
| **M9** | W-E | West | East | Through | West approach to east exit (Through) |
| **M10** | W-N | West | North | Left | West approach to north exit (Left turn) |
| **M11** | W-S | West | South | Right | West approach to south exit (Right turn) |

---

## 2. Conflict Graph $G = (V, E)$
The junction is modeled as an undirected graph where vertices $V = \{0, \dots, 11\}$ represent movements and edges $E$ represent safety conflicts (incompatible movements that cannot receive green simultaneously).

### Key Compatible Independent Sets (Maximal Green Phases):
1. **North-South Through Phase**: $\{M0, M3, M2, M4\}$
2. **North-South Dual Left Phase**: $\{M1, M5, M2, M4\}$
3. **East-West Through Phase**: $\{M6, M9, M7, M11\}$
4. **East-West Dual Left Phase**: $\{M8, M10, M7, M11\}$

### Total Graph Properties:
- Vertices $|V| = 12$
- Edges $|E| = 28$
- Symmetry: $(u, v) \in E \iff (v, u) \in E$
- Irreflexivity: $(u, u) \notin E$ (no self-loops)

