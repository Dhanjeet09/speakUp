FROM node:20-alpine AS base
WORKDIR /app

# hadolint ignore=DL3003
RUN apk add --no-cache dumb-init

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/ packages/

FROM base AS deps
RUN npm ci --workspace=apps/server --workspace=packages/* --include-workspace-root --only=production

FROM deps AS builder
COPY . .
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma
RUN npx turbo build --scope=@speakup/server --include-dependencies
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

FROM base AS runner
ENV NODE_ENV=production \
    PORT=4000
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY apps/server/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["docker-entrypoint.sh"]
