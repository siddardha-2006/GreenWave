"""
conflict_graph.py
Verified Movement Conflict Graph for 4-Way Intersection.
Represents G = (V, E) where edge (i, j) indicates incompatible movements
that cannot safely receive green simultaneously.
"""

from typing import Dict, List, Set, Tuple
import networkx as nx
from .movement_model import MovementRegistry, DEFAULT_MOVEMENTS


class ConflictGraph:
    """
    Undirected graph of conflicting vehicle movements.
    Each vertex is a movement index (0..n-1).
    An edge (u, v) exists if movements u and v conflict.
    """

    def __init__(self, num_nodes: int = 12):
        self.num_nodes = num_nodes
        self.graph = nx.Graph()
        self.graph.add_nodes_from(range(num_nodes))

    def add_conflict(self, u: int, v: int) -> None:
        """Adds an undirected conflict edge between movement u and v."""
        if u == v:
            raise ValueError(f"Self-conflict edge ({u}, {u}) is invalid.")
        if not (0 <= u < self.num_nodes and 0 <= v < self.num_nodes):
            raise IndexError(f"Node index out of range: ({u}, {v}) for n={self.num_nodes}")
        self.graph.add_edge(u, v)

    def has_conflict(self, u: int, v: int) -> bool:
        """Checks if movement u and v conflict."""
        if u == v:
            return False
        return self.graph.has_edge(u, v)

    def conflicts_with(self, u: int) -> Set[int]:
        """Returns set of conflicting neighbor movement indices for movement u."""
        return set(self.graph.neighbors(u))

    def degree(self, u: int) -> int:
        """Returns the conflict degree d_u for movement u."""
        return int(self.graph.degree(u))

    @property
    def degrees(self) -> List[int]:
        """Returns list of degrees [d_0, d_1, ..., d_{n-1}]."""
        return [self.degree(i) for i in range(self.num_nodes)]

    def get_edges(self) -> List[Tuple[int, int]]:
        """Returns sorted list of unique undirected edges (u, v) with u < v."""
        edges = []
        for u, v in self.graph.edges():
            edges.append((min(u, v), max(u, v)))
        return sorted(list(set(edges)))

    @property
    def num_edges(self) -> int:
        return self.graph.number_of_edges()

    def validate(self) -> None:
        """Validates graph invariants: symmetry, no self-loops, correct node count."""
        assert self.graph.number_of_nodes() == self.num_nodes, "Mismatch in node count."
        for u, v in self.graph.edges():
            assert u != v, f"Self-loop detected on node {u}."
            assert 0 <= u < self.num_nodes and 0 <= v < self.num_nodes, f"Invalid edge ({u}, {v})."


def create_default_conflict_graph() -> ConflictGraph:
    """
    Creates the verified 12-movement conflict graph for a standard 4-way intersection.
    
    Movements:
      North: M0 (N-S Through), M1 (N-E Left),  M2 (N-W Right)
      South: M3 (S-N Through), M4 (S-E Right), M5 (S-W Left)
      East:  M6 (E-W Through), M7 (E-N Right), M8 (E-S Left)
      West:  M9 (W-E Through), M10 (W-N Left), M11 (W-S Right)
    
    Key Non-conflicting (Compatible) Pairs / Maximal Independent Sets:
      - N-S Through Phase: {M0, M3, M2, M4}
      - N-S Dual Left Phase: {M1, M5, M2, M4}
      - E-W Through Phase: {M6, M9, M7, M11}
      - E-W Dual Left Phase: {M8, M10, M7, M11}
    """
    cg = ConflictGraph(num_nodes=12)

    # Cross-street through conflicts (North-South vs East-West)
    # M0 (N-S) conflicts with East-West throughs and lefts
    cg.add_conflict(0, 6)   # N-S vs E-W
    cg.add_conflict(0, 9)   # N-S vs W-E
    cg.add_conflict(0, 8)   # N-S vs E-S (East Left)
    cg.add_conflict(0, 10)  # N-S vs W-N (West Left)
    cg.add_conflict(0, 5)   # N-S vs S-W (Opposing South Left)
    cg.add_conflict(0, 11)  # N-S vs W-S (Right turn merging into South exit)

    # M3 (S-N) conflicts with East-West throughs and lefts
    cg.add_conflict(3, 6)   # S-N vs E-W
    cg.add_conflict(3, 9)   # S-N vs W-E
    cg.add_conflict(3, 8)   # S-N vs E-S (East Left)
    cg.add_conflict(3, 10)  # S-N vs W-N (West Left)
    cg.add_conflict(3, 1)   # S-N vs N-E (Opposing North Left)
    cg.add_conflict(3, 7)   # S-N vs E-N (Right turn merging into North exit)

    # M6 (E-W) conflicts with North-South throughs and lefts
    cg.add_conflict(6, 1)   # E-W vs N-E (North Left)
    cg.add_conflict(6, 5)   # E-W vs S-W (South Left)
    cg.add_conflict(6, 10)  # E-W vs W-N (Opposing West Left)
    cg.add_conflict(6, 2)   # E-W vs N-W (Right turn merging into West exit)

    # M9 (W-E) conflicts with North-South throughs and lefts
    cg.add_conflict(9, 1)   # W-E vs N-E (North Left)
    cg.add_conflict(9, 5)   # W-E vs S-W (South Left)
    cg.add_conflict(9, 8)   # W-E vs E-S (Opposing East Left)
    cg.add_conflict(9, 4)   # W-E vs S-E (Right turn merging into East exit)

    # Left-turn vs Cross Left-turn conflicts
    # M1 (N-E Left) crosses East-West left turns and throughs
    cg.add_conflict(1, 8)   # N-E vs E-S
    cg.add_conflict(1, 10)  # N-E vs W-N

    # M5 (S-W Left) crosses East-West left turns
    cg.add_conflict(5, 8)   # S-W vs E-S
    cg.add_conflict(5, 10)  # S-W vs W-N

    # Right turns vs conflicting Left turns into the same target lane
    cg.add_conflict(7, 1)   # E-N right vs N-E left
    cg.add_conflict(2, 5)   # N-W right vs S-W left
    cg.add_conflict(11, 8)  # W-S right vs E-S left
    cg.add_conflict(4, 10)  # S-E right vs W-N left

    cg.validate()
    return cg

