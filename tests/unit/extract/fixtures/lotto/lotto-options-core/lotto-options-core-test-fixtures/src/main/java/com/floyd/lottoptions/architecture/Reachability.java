package com.floyd.lottoptions.architecture;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.domain.JavaModifier;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import static java.util.stream.Collectors.toMap;

/**
 * The class-level dead-code check: every top-level class must be reachable from an entry point.
 *
 * <p>Entry points are the classes Spring or the JVM call without anything in the code base
 * referring to them:</p>
 * <ul>
 *   <li>classes (meta-)annotated {@code @Configuration} (which covers {@code @SpringBootApplication}
 *       and auto-configurations), {@code @Controller} (and {@code @RestController}) or
 *       {@code @ControllerAdvice} (and {@code @RestControllerAdvice});</li>
 *   <li>classes declaring a {@code @Bean}, {@code @EventListener} or {@code @Scheduled} method;</li>
 *   <li>{@code WebFilter} components;</li>
 *   <li>classes declaring {@code static void main(String[])}.</li>
 * </ul>
 *
 * <p>From there the walk follows every bytecode dependency (calls, field and signature types,
 * annotations and their class-literal parameters), from a nested class to its enclosing class,
 * and from a type to its subclasses and implementations: injecting an interface reaches every
 * implementation. A component that no entry point injects is therefore reported, even though
 * Spring instantiates it.</p>
 *
 * <p>Nested classes are judged with their top-level class. The walk cannot see reflection by
 * name, SpEL bean references or {@code AutoConfiguration.imports} registrations; none exist today.
 * The first such entry point adds an allow-list annotation as another root, rather than a
 * frozen false positive.</p>
 */
public final class Reachability {

    private static final List<String> ENTRY_POINT_TYPE_ANNOTATIONS = List.of(
            "org.springframework.context.annotation.Configuration",
            "org.springframework.stereotype.Controller",
            "org.springframework.web.bind.annotation.ControllerAdvice");
    private static final List<String> ENTRY_POINT_METHOD_ANNOTATIONS = List.of(
            "org.springframework.context.annotation.Bean",
            "org.springframework.context.event.EventListener",
            "org.springframework.scheduling.annotation.Scheduled");
    private static final String COMPONENT = "org.springframework.stereotype.Component";
    private static final String WEB_FILTER = "org.springframework.web.server.WebFilter";

    private Reachability() {
    }

    /** The condition for {@code classes().should(...)}; it needs every imported class to walk. */
    public static ArchCondition<JavaClass> beReachableFromAnEntryPoint() {
        return new ReachableFromAnEntryPoint();
    }

    static boolean isEntryPoint(JavaClass javaClass) {
        return ENTRY_POINT_TYPE_ANNOTATIONS.stream().anyMatch(javaClass::isMetaAnnotatedWith)
                || javaClass.getMethods().stream().anyMatch(Reachability::isEntryPointMethod)
                || (javaClass.isAssignableTo(WEB_FILTER) && javaClass.isMetaAnnotatedWith(COMPONENT));
    }

    private static boolean isEntryPointMethod(JavaMethod method) {
        return ENTRY_POINT_METHOD_ANNOTATIONS.stream().anyMatch(method::isMetaAnnotatedWith) || isMain(method);
    }

    private static boolean isMain(JavaMethod method) {
        return method.getName().equals("main")
                && method.getModifiers().contains(JavaModifier.STATIC)
                && method.getRawParameterTypes().size() == 1
                && method.getRawParameterTypes().get(0).getName().equals(String[].class.getName());
    }

    private static final class ReachableFromAnEntryPoint extends ArchCondition<JavaClass> {

        private Set<String> reached = Set.of();

        ReachableFromAnEntryPoint() {
            super("be reachable from an entry point");
        }

        @Override
        public void init(Collection<JavaClass> allClasses) {
            Map<String, JavaClass> imported = allClasses.stream()
                    .collect(toMap(JavaClass::getName, Function.identity()));
            Deque<JavaClass> pending = new ArrayDeque<>();
            allClasses.stream().filter(Reachability::isEntryPoint).forEach(pending::add);
            Set<String> visited = new HashSet<>();
            while (!pending.isEmpty()) {
                JavaClass current = pending.poll();
                if (!visited.add(current.getName())) {
                    continue;
                }
                current.getDirectDependenciesFromSelf().stream()
                        .map(Dependency::getTargetClass)
                        .map(JavaClass::getBaseComponentType)
                        .forEach(target -> enqueueIfImported(target, imported, pending));
                current.getEnclosingClass().ifPresent(enclosing -> enqueueIfImported(enclosing, imported, pending));
                current.getSubclasses().forEach(subclass -> enqueueIfImported(subclass, imported, pending));
            }
            reached = visited;
        }

        private static void enqueueIfImported(JavaClass javaClass, Map<String, JavaClass> imported,
                                              Deque<JavaClass> pending) {
            JavaClass importedClass = imported.get(javaClass.getName());
            if (importedClass != null) {
                pending.add(importedClass);
            }
        }

        @Override
        public void check(JavaClass javaClass, ConditionEvents events) {
            if (!javaClass.isTopLevelClass() || javaClass.getSimpleName().equals("package-info")) {
                return;
            }
            boolean isReached = reached.contains(javaClass.getName());
            String message = String.format("Class <%s> is %s", javaClass.getName(),
                    isReached ? "reachable from an entry point" : "not reachable from any entry point");
            events.add(new SimpleConditionEvent(javaClass, isReached, message));
        }
    }
}
