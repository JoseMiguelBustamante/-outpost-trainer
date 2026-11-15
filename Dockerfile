# Build stage: compile the Vite + TypeScript app
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# Serve stage: static files behind nginx
FROM nginx:1.27-alpine AS serve

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
