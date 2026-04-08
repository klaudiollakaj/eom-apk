FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && node scripts/clean-output.mjs

FROM base AS runner
COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/app/lib ./app/lib
COPY --from=build /app/.output/server/node_modules ./.output/server/node_modules
WORKDIR /app
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
