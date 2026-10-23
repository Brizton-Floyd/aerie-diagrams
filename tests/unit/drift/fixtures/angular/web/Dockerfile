FROM node:24-alpine AS build
WORKDIR /app
COPY package.json angular.json tsconfig.json tsconfig.app.json ./
COPY src src
RUN npm ci && npx ng build

FROM nginx:1.28-alpine
COPY nginx/ /etc/nginx/
COPY --from=build /app/dist/storefront/browser /usr/share/nginx/html
EXPOSE 80
