FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
RUN pnpm install --filter @poetry/backend... --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/backend packages/backend
RUN pnpm --filter @poetry/shared build
RUN pnpm --filter @poetry/backend build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=deps /app/packages/backend/node_modules packages/backend/node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/backend/package.json packages/backend/package.json
WORKDIR /app/packages/backend
EXPOSE 8787
CMD ["node", "dist/server.js"]
