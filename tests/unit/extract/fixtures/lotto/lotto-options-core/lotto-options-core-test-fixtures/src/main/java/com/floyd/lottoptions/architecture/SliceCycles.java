package com.floyd.lottoptions.architecture;

import com.tngtech.archunit.ArchConfiguration;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.dependencies.Slice;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * The package-cycle check: {@code slices().matching(...).should(SliceCycles.beFreeOfCycles())}.
 *
 * <p>It replaces ArchUnit's {@code beFreeOfCycles()}, whose cycle finder (ArchUnit 1.5.1) misses
 * whole cycles: when its search starts from a slice outside every cycle, it takes the first cycle
 * that slice reaches and skips any other cycle between them in its node order. This condition
 * runs Johnson's algorithm on the strongly connected component of each slice, so it reports every
 * elementary cycle (up to {@code cycles.maxNumberToDetect}).</p>
 *
 * <p>Violations read exactly like ArchUnit's: the cycle starts at its alphabetically first slice,
 * and each edge lists up to {@code cycles.maxNumberOfDependenciesPerEdge} dependencies. Frozen
 * cycles recorded by ArchUnit's rule therefore stay known, matched by {@link SameCycleMatcher}.</p>
 */
public final class SliceCycles {

    private static final String EDGE_SEPARATOR = " -> " + System.lineSeparator() + "                ";
    private static final String DETAILS_INDENT = "    ";

    private SliceCycles() {
    }

    /** The condition for {@code slices().matching(...).should(...)}. */
    public static ArchCondition<Slice> beFreeOfCycles() {
        return new FreeOfCycles();
    }

    private static final class FreeOfCycles extends ArchCondition<Slice> {

        private List<Slice> slices = List.of();
        private List<Map<Integer, List<Dependency>>> edges = List.of();

        FreeOfCycles() {
            super("be free of cycles");
        }

        @Override
        public void init(Collection<Slice> allSlices) {
            slices = allSlices.stream().sorted(Comparator.comparing(Slice::getDescription)).toList();
            Map<String, Integer> sliceOfClass = new HashMap<>();
            for (int i = 0; i < slices.size(); i++) {
                for (JavaClass javaClass : slices.get(i)) {
                    sliceOfClass.put(javaClass.getName(), i);
                }
            }
            edges = new ArrayList<>();
            for (int i = 0; i < slices.size(); i++) {
                Map<Integer, List<Dependency>> outgoing = new TreeMap<>();
                for (Dependency dependency : slices.get(i).getDependenciesFromSelf()) {
                    Integer target = sliceOfClass.get(dependency.getTargetClass().getBaseComponentType().getName());
                    if (target != null && target != i) {
                        outgoing.computeIfAbsent(target, ignored -> new ArrayList<>()).add(dependency);
                    }
                }
                edges.add(outgoing);
            }
        }

        @Override
        public void check(Slice slice, ConditionEvents events) {
        }

        @Override
        public void finish(ConditionEvents events) {
            int maxCycles = Integer.parseInt(
                    ArchConfiguration.get().getPropertyOrDefault("cycles.maxNumberToDetect", "100"));
            int maxDependencies = Integer.parseInt(
                    ArchConfiguration.get().getPropertyOrDefault("cycles.maxNumberOfDependenciesPerEdge", "20"));
            for (List<Integer> cycle : new Johnson(edges, maxCycles).findCycles()) {
                List<Slice> cycleSlices = cycle.stream().map(slices::get).toList();
                events.add(SimpleConditionEvent.violated(cycleSlices, describe(cycle, maxDependencies)));
            }
        }

        private String describe(List<Integer> cycle, int maxDependencies) {
            List<String> path = new ArrayList<>();
            List<String> details = new ArrayList<>();
            for (int k = 0; k < cycle.size(); k++) {
                int origin = cycle.get(k);
                int target = cycle.get((k + 1) % cycle.size());
                path.add(slices.get(origin).getDescription());
                details.add(String.format("  %d. Dependencies of %s", k + 1, slices.get(origin).getDescription())
                        + System.lineSeparator() + describeDependencies(edges.get(origin).get(target), maxDependencies));
            }
            path.add(path.get(0));
            return "Cycle detected: " + String.join(EDGE_SEPARATOR, path) + System.lineSeparator()
                    + String.join(System.lineSeparator(), details);
        }

        private static String describeDependencies(List<Dependency> dependencies, int maxDependencies) {
            List<String> lines = dependencies.stream()
                    .sorted()
                    .limit(maxDependencies)
                    .map(dependency -> DETAILS_INDENT + "- " + dependency.getDescription())
                    .collect(Collectors.toCollection(ArrayList::new));
            if (dependencies.size() > maxDependencies) {
                lines.add(DETAILS_INDENT + String.format("(%d further dependencies have been omitted...)",
                        dependencies.size() - maxDependencies));
            }
            return String.join(System.lineSeparator(), lines);
        }
    }

    /** Johnson's elementary-cycle search; each cycle starts at its lowest node. */
    private static final class Johnson {

        private final List<Map<Integer, List<Dependency>>> edges;
        private final int maxCycles;
        private final List<List<Integer>> cycles = new ArrayList<>();
        private final Deque<Integer> stack = new ArrayDeque<>();
        private final Set<Integer> blocked = new HashSet<>();
        private final Map<Integer, Set<Integer>> blockedBy = new HashMap<>();
        private Set<Integer> component = Set.of();
        private int start;

        Johnson(List<Map<Integer, List<Dependency>>> edges, int maxCycles) {
            this.edges = edges;
            this.maxCycles = maxCycles;
        }

        List<List<Integer>> findCycles() {
            for (start = 0; start < edges.size() && cycles.size() < maxCycles; start++) {
                component = componentOfStart();
                if (component.size() > 1) {
                    blocked.clear();
                    blockedBy.clear();
                    circuit(start);
                }
            }
            return cycles;
        }

        /** The strongly connected component of {@code start} among the nodes from {@code start} up. */
        private Set<Integer> componentOfStart() {
            Set<Integer> forward = reachable(true);
            Set<Integer> backward = reachable(false);
            forward.retainAll(backward);
            return forward;
        }

        private Set<Integer> reachable(boolean forward) {
            Set<Integer> reached = new HashSet<>(Set.of(start));
            Deque<Integer> pending = new ArrayDeque<>(reached);
            while (!pending.isEmpty()) {
                int node = pending.poll();
                for (int next = start; next < edges.size(); next++) {
                    boolean edge = forward ? edges.get(node).containsKey(next) : edges.get(next).containsKey(node);
                    if (edge && reached.add(next)) {
                        pending.add(next);
                    }
                }
            }
            return reached;
        }

        private boolean circuit(int node) {
            boolean found = false;
            stack.addLast(node);
            blocked.add(node);
            for (int next : edges.get(node).keySet()) {
                if (cycles.size() >= maxCycles) {
                    break;
                }
                if (!component.contains(next)) {
                    continue;
                }
                if (next == start) {
                    cycles.add(List.copyOf(stack));
                    found = true;
                } else if (!blocked.contains(next) && circuit(next)) {
                    found = true;
                }
            }
            if (found) {
                unblock(node);
            } else {
                for (int next : edges.get(node).keySet()) {
                    if (component.contains(next)) {
                        blockedBy.computeIfAbsent(next, ignored -> new HashSet<>()).add(node);
                    }
                }
            }
            stack.removeLast();
            return found;
        }

        private void unblock(int node) {
            blocked.remove(node);
            Set<Integer> waiting = blockedBy.remove(node);
            if (waiting != null) {
                for (int other : waiting) {
                    if (blocked.contains(other)) {
                        unblock(other);
                    }
                }
            }
        }
    }
}
