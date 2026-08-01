FROM node:24-alpine

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY server ./server

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server/index.mjs"]
