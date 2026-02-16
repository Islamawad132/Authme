# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 1b: Admin UI dependencies
FROM node:22-alpine AS admin-deps
WORKDIR /app/admin-ui
COPY admin-ui/package.json admin-ui/package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=admin-deps /app/admin-ui/node_modules ./admin-ui/node_modules
COPY . .
# Build admin UI
RUN cd admin-ui && npm run build
# Build NestJS backend
RUN npx prisma generate
RUN npm run build
# Copy admin-ui build output into dist
RUN cp -r admin-ui/dist dist/admin-ui
RUN npm prune --production

# Stage 3: Production
FROM node:22-alpine AS production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/themes ./themes
COPY --from=build /app/package.json ./package.json

# Prisma config needed for migrate deploy
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

ENV NODE_ENV=production
EXPOSE 3000

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
