# syntax=docker/dockerfile:1
#
# Builds the Web UI (lotto-options-ui, read from the `ui-src` build context)
# and serves it with nginx, which also reverse-proxies the UI's relative /ui/* calls to the
# BFF - the job proxy.conf.json does for `ng serve`. See "Local stack" in README.md.

FROM node:24-alpine AS build
# The angular.json configuration to build. `development` is what `ng serve` serves today;
# lotto-options-ui's `production` build currently fails its component-style budget.
ARG UI_BUILD_CONFIGURATION=development
ENV NG_CLI_ANALYTICS=false
WORKDIR /src
COPY --from=ui-src package.json package-lock.json ./
RUN --mount=type=cache,id=lotto-stack-npm,target=/root/.npm \
    npm ci --no-audit --no-fund
# Only sources and build config are copied, so node_modules or dist from a host checkout never leak in.
COPY --from=ui-src angular.json tsconfig.json tsconfig.app.json ./
COPY --from=ui-src public public
COPY --from=ui-src src src
RUN npx ng build --configuration "${UI_BUILD_CONFIGURATION}"

FROM nginx:1.28-alpine
# Where nginx sends /ui/*; the image's entrypoint substitutes it into the template.
ENV BFF_URL=http://bff:8080
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/lotto-options-ui/browser /usr/share/nginx/html
EXPOSE 80
