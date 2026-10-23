package com.floyd.lottoptions.architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.core.importer.Location;

import java.util.Arrays;
import java.util.List;

/**
 * Imports the main classes of the named Maven modules of this repo and nothing else.
 *
 * <p>A module's classes come from its {@code target/classes} in a reactor {@code test} run, from
 * its packaged jar in a reactor {@code verify} run, and from the local Maven repository when one
 * module is built alone. Each of those locations contains the module's directory name (for
 * example {@code /lotto-options-core-model/}), so the option matches on it. Test classes and
 * every other jar stay out, including this fixtures module and the results service's models,
 * whose types the rules still see as dependency targets.</p>
 *
 * <p>Subclass it with a public no-argument constructor to use it in {@code @AnalyzeClasses}.</p>
 */
public abstract class ProjectModules implements ImportOption {

    private static final ImportOption MAIN_CLASSES_ONLY = new DoNotIncludeTests();

    private final List<String> moduleDirectories;

    protected ProjectModules(String... moduleNames) {
        this.moduleDirectories = Arrays.stream(moduleNames).map(name -> "/" + name + "/").toList();
    }

    @Override
    public boolean includes(Location location) {
        return MAIN_CLASSES_ONLY.includes(location) && moduleDirectories.stream().anyMatch(location::contains);
    }
}
