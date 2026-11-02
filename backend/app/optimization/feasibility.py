"""
feasibility.py
Independent Feasibility and Safety Validator for GREEN-WAVE.
Implements strict checks ensuring that candidate movement sets contain
zero conflicting movements, and provides deterministic fallback policies.
"""

from typing import List, Optional, Set, Tuple
import numpy as np
from .conflict_graph import ConflictGraph


class FeasibilityValidator:
    """
    Independent validator that verifies candidate movement selections
    against the conflict graph.
    """

    def __init__(self, conflict_graph: ConflictGraph):
        self.conflict_graph = conflict_graph

    def is_feasible(self, bitstring_or_indices) -> bool:
        """
        Determines whether the selected movements form an Independent Set (no conflicts).
        
        Args:
            bitstring_or_indices: Either a list/array of 0/1 bits (length n)
                                  or a list/set of active movement indices.
        """
        active_indices = self._to_active_indices(bitstring_or_indices)
        violations = self.find_violations(active_indices)
        return len(violations) == 0

    def find_violations(self, bitstring_or_indices) -> List[Tuple[int, int]]:
        """
        Finds all conflicting pairs of simultaneously active movements.
        
        Returns:
            List of (u, v) tuples indicating conflicting movements.
        """
        active = self._to_active_indices(bitstring_or_indices)
        violations = []
        active_list = sorted(list(active))

        for i in range(len(active_list)):
            u = active_list[i]
            for j in range(i + 1, len(active_list)):
                v = active_list[j]
                if self.conflict_graph.has_conflict(u, v):
                    violations.append((u, v))

        return violations

    def get_safe_fallback(self, weights: np.ndarray) -> np.ndarray:
        """
        Deterministic safe fallback policy when an optimizer returns invalid/infeasible output.
        Selects the single movement with highest priority weight (and any mutually compatible
        right turns), ensuring guaranteed 100% feasibility.
        
        Returns:
            Binary bit vector of shape (n,) representing safe green phase.
        """
        n = self.conflict_graph.num_nodes
        fallback_bits = np.zeros(n, dtype=int)
        
        # Pick the single highest priority movement
        highest_idx = int(np.argmax(weights))
        fallback_bits[highest_idx] = 1

        # Greedily include other compatible movements by weight order
        sorted_indices = np.argsort(-weights)
        for idx in sorted_indices:
            idx = int(idx)
            if idx == highest_idx:
                continue
            # Check if compatible with all currently selected
            compatible = True
            for selected_idx in np.where(fallback_bits == 1)[0]:
                if self.conflict_graph.has_conflict(idx, int(selected_idx)):
                    compatible = False
                    break
            if compatible:
                fallback_bits[idx] = 1

        return fallback_bits

    def _to_active_indices(self, obj) -> Set[int]:
        """Helper to convert bitstrings, bit arrays, or index lists to a set of active indices."""
        if isinstance(obj, (set, list, tuple)):
            if len(obj) == 0:
                return set()
            # Check if it's a bit vector (all elements 0 or 1 and length matches node count)
            if len(obj) == self.conflict_graph.num_nodes and all(x in (0, 1) for x in obj):
                return {i for i, b in enumerate(obj) if b == 1}
            # Otherwise assume it's a list of active indices
            return set(obj)
        elif isinstance(obj, np.ndarray):
            if obj.ndim == 1 and len(obj) == self.conflict_graph.num_nodes:
                return {i for i, b in enumerate(obj) if b == 1}
            return set(obj.tolist())
        elif isinstance(obj, str):
            # Binary string representation e.g. "100001000000"
            return {i for i, char in enumerate(obj) if char == '1'}
        else:
            raise TypeError(f"Unsupported candidate type: {type(obj)}")

