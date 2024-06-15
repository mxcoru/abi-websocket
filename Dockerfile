
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json ./
RUN npm install -g pnpm
RUN  pnpm install --production
RUN  pnpx prisma generate

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm install -g pnpm
RUN pnpx prisma generate

RUN pnpm run build

FROM node:slim AS runner
WORKDIR /app
COPY prisma ./prisma

ENV NODE_ENV production

RUN addgroup --system --gid 1001 appUser
RUN adduser --system --uid 1001 appUser

COPY --from=builder --chown=appUser:nodejs /app/dist ./.dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN npx prisma generate

USER appUser

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "start"]