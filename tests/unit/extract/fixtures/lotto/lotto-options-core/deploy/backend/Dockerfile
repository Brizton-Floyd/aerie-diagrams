# syntax=docker/dockerfile:1
#
# Builds the local stack's three JVM services from source; pick one with --target:
#   results-service  lottery-result-persistence-service, read from the `results-service-src` build context
#   core             lotto-options-core-server (this repository)
#   bff              lotto-options-core-bff (this repository)
# compose.yaml at the repository root wires the contexts; see "Local stack" in README.md.

# --- Results service build -------------------------------------------------------------
# Only poms and sources are copied, so build output from a host checkout never leaks in.
FROM maven:3.9.11-eclipse-temurin-17 AS results-service-build
WORKDIR /src
COPY --from=results-service-src pom.xml ./
COPY --from=results-service-src lottery-result-persistence-service-models/pom.xml lottery-result-persistence-service-models/
COPY --from=results-service-src lottery-result-persistence-service-models/src lottery-result-persistence-service-models/src
COPY --from=results-service-src lottery-result-aggregator/pom.xml lottery-result-aggregator/
COPY --from=results-service-src lottery-result-aggregator/src lottery-result-aggregator/src
COPY --from=results-service-src lottery-result-persistence-server/pom.xml lottery-result-persistence-server/
COPY --from=results-service-src lottery-result-persistence-server/src lottery-result-persistence-server/src
# The results service's parent pom names every module's jar result-persistence-service.jar,
# so each artifact is copied out of its own module's target directory.
RUN --mount=type=cache,id=lotto-stack-maven,target=/root/.m2,sharing=locked \
    mvn -B -ntp -DskipTests package \
 && mkdir -p /out/models \
 && cp lottery-result-persistence-server/target/*.jar /out/results-service.jar \
 && cp lottery-result-persistence-service-models/target/*.jar /out/models/models.jar \
 && cp lottery-result-persistence-service-models/pom.xml /out/models/pom.xml \
 && cp pom.xml /out/models/parent-pom.xml

# --- Core and BFF build ----------------------------------------------------------------
# Core compiles against lottery-result-persistence-service-models, which is published
# nowhere: seed this build's own Maven repository with it (and its parent pom) from the
# results service build above. Nothing here touches a host ~/.m2.
FROM maven:3.9.11-eclipse-temurin-17 AS core-build
WORKDIR /src
COPY --from=results-service-build /out/models /results-models
COPY pom.xml lombok.config ./
COPY lotto-options-core-domain/pom.xml lotto-options-core-domain/
COPY lotto-options-core-domain/src lotto-options-core-domain/src
COPY lotto-options-core-application/pom.xml lotto-options-core-application/
COPY lotto-options-core-application/src lotto-options-core-application/src
COPY lotto-options-core-api-contract/pom.xml lotto-options-core-api-contract/
COPY lotto-options-core-api-contract/src lotto-options-core-api-contract/src
COPY lotto-options-core-model/pom.xml lotto-options-core-model/
COPY lotto-options-core-model/src lotto-options-core-model/src
COPY lotto-options-core-result-analyzer/pom.xml lotto-options-core-result-analyzer/
COPY lotto-options-core-result-analyzer/src lotto-options-core-result-analyzer/src
COPY lotto-options-core-legacy-desktop/pom.xml lotto-options-core-legacy-desktop/
COPY lotto-options-core-legacy-desktop/src lotto-options-core-legacy-desktop/src
COPY lotto-options-core-test-fixtures/pom.xml lotto-options-core-test-fixtures/
COPY lotto-options-core-test-fixtures/src lotto-options-core-test-fixtures/src
COPY lotto-options-core-server/pom.xml lotto-options-core-server/
COPY lotto-options-core-server/src lotto-options-core-server/src
COPY lotto-options-core-bff/pom.xml lotto-options-core-bff/
COPY lotto-options-core-bff/src lotto-options-core-bff/src
RUN --mount=type=cache,id=lotto-stack-maven,target=/root/.m2,sharing=locked \
    mvn -B -ntp install:install-file -Dpackaging=pom \
        -Dfile=/results-models/parent-pom.xml -DpomFile=/results-models/parent-pom.xml \
 && mvn -B -ntp install:install-file \
        -Dfile=/results-models/models.jar -DpomFile=/results-models/pom.xml \
 && mvn -B -ntp -DskipTests package -pl lotto-options-core-server,lotto-options-core-bff -am \
 && mkdir -p /out \
 && cp lotto-options-core-server/target/lotto-options-core-service.jar /out/core.jar \
 && cp lotto-options-core-bff/target/lotto-options-core-bff-service.jar /out/bff.jar

# --- Runtimes ---------------------------------------------------------------------------
FROM eclipse-temurin:17-jre-noble AS runtime
RUN groupadd --system app && useradd --system --gid app --no-create-home app
WORKDIR /app
USER app
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]

FROM runtime AS results-service
USER root
# The draw store. Compose mounts a named volume here; a new volume takes this directory's
# ownership, so the service can write to it without running as root.
RUN mkdir /data && chown app:app /data
USER app
ENV LOTTERY_STORAGE_BASEDIR=/data
COPY --from=results-service-build /out/results-service.jar app.jar
EXPOSE 8001

FROM runtime AS core
COPY --from=core-build /out/core.jar app.jar
EXPOSE 8002

FROM runtime AS bff
COPY --from=core-build /out/bff.jar app.jar
EXPOSE 8080
