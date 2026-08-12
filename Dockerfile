FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY scripts scripts
RUN pnpm --filter @credora/api build
RUN mkdir -p /data && chown -R node:node /data

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 4000
CMD ["pnpm", "--filter", "@credora/api", "start"]
