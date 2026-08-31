# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
# Prefer npm ci when lockfile exists; fall back to install (no lockfile in repo yet)
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev && cp -R node_modules /tmp/prod_node_modules && npm ci; \
    else \
      npm install --omit=dev --legacy-peer-deps && cp -R node_modules /tmp/prod_node_modules && \
      npm install --legacy-peer-deps; \
    fi

# ---- Build (prisma generate needs full deps) ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /tmp/prod_node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY . .

# Runs as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
