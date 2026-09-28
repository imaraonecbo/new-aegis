FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build && npm run contract:compile
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/contracts ./contracts
COPY --from=build /app/hardhat.config.ts ./hardhat.config.ts
USER node
EXPOSE 3000
CMD ["node","dist/server.cjs"]