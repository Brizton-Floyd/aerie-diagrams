# syntax=docker/dockerfile:1
ARG JDK=17
FROM eclipse-temurin:${JDK} AS base
WORKDIR /app

FROM maven:3.9 AS build
ARG MODULE=orders-core
COPY --from=orders-src pom.xml ./
COPY --from=orders-src ${MODULE}/src ${MODULE}/src
COPY ["shared config/", "/config/"]
RUN --mount=type=bind,from=orders-src,source=settings.xml,target=/root/.m2/settings.xml \
    --mount=type=cache,target=/root/.m2/repository \
    mvn -B package

FROM base AS runtime
COPY --from=build /out/app.jar app.jar
COPY --from=tools /bin/busybox /bin/
COPY --from=0 /etc/os-release /etc/
EXPOSE 8080
ENV REPORTS_URL=http://reports:9000

FROM runtime AS debug
EXPOSE 5005
COPY debug/agent.jar /agent.jar
