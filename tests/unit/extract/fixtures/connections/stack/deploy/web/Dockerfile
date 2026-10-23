FROM node:22 AS build
ENV BUILD_ONLY_URL=http://builder:1
WORKDIR /src
COPY . .
RUN npm ci && npm run build

FROM nginx:1.27
ENV UPSTREAM=http://api:8080
ENV OVERRIDDEN=http://old-api:8080
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
