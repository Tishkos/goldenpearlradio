FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy source needed by Vite build
COPY client ./client
COPY vite.config.ts ./vite.config.ts
COPY tsconfig.json ./tsconfig.json
COPY postcss.config.js ./postcss.config.js
COPY tailwind.config.ts ./tailwind.config.ts
COPY components.json ./components.json

# Build-time frontend environment
ARG VITE_API_URL
ARG VITE_STREAM_SERVER_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_STREAM_SERVER_URL=${VITE_STREAM_SERVER_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/public /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1
