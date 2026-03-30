FROM node:20-slim

# Install FFmpeg (required for audio streaming)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and source
COPY package*.json ./
COPY prisma ./prisma/
COPY server ./server/
COPY lib ./lib/

# Install deps and generate Prisma client
RUN npm ci
RUN npx prisma generate

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Sync schema to DB on start, then run server
CMD ["sh", "-c", "npx prisma db push --skip-generate 2>/dev/null || true && exec npx tsx server/src/index.ts"]
