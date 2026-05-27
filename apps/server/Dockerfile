FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci --workspace=apps/server --workspace=packages/* --include-workspace-root

FROM deps AS builder
COPY . .
RUN npx turbo build --scope=@speakup/server --include-dependencies
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 4000
CMD ["node", "dist/index.js"]
