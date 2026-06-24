FROM node:20-slim

WORKDIR /app

# Build tools required by better-sqlite3 (node-gyp native compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests for layer caching
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json

# Skip Playwright auto-download during npm install
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN npm ci

# Install Playwright's Chromium with all OS-level dependencies
RUN npx playwright install --with-deps chromium

# Copy backend source
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/prisma ./packages/backend/prisma
COPY packages/backend/tsconfig.json ./packages/backend/tsconfig.json

# Generate Prisma client and compile TypeScript
RUN cd packages/backend && npx prisma generate && npm run build

EXPOSE 3001

# On start: run pending migrations then start the server
CMD ["sh", "-c", "cd packages/backend && npx prisma migrate deploy && node dist/index.js"]
