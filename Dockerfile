FROM node:18-alpine AS base

ARG VERSION_ARG

# Install dependencies only when needed
FROM base AS deps

# Install necessary packages
RUN apk add --no-cache libc6-compat openssl python3 make g++

WORKDIR /app

# Install dependencies
COPY yarn.lock package.json ./
RUN yarn install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn run prisma-generate-build
RUN yarn run build
RUN rm -rf ./next/standalone

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PYTHON=/usr/bin/python3
ENV QS_VERSION=$VERSION_ARG

RUN apk add --no-cache git

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir storage tmp-storage
RUN chown nextjs:nodejs storage tmp-storage

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

ENV PORT=3000

CMD HOSTNAME="0.0.0.0" npm run start-prod
