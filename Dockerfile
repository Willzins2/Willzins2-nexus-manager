# Imagem única: build do frontend + API, servidos pelo mesmo processo Node.
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY server/package*.json server/
COPY web/package*.json web/
RUN npm ci --prefix server && npm ci --prefix web
COPY . .
RUN npm run build --prefix web && npm run build --prefix server && npm prune --omit=dev --prefix server

FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3333
COPY --from=build /app/server/node_modules server/node_modules
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/server/package.json server/
COPY --from=build /app/web/dist web/dist
EXPOSE 3333
USER node
# Aplica migrations pendentes e sobe a API. Para popular a demo: docker compose run app node server/dist/seed.js
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/server.js"]
