FROM node:20-slim

WORKDIR /app

RUN npm install -g pnpm

COPY . .

RUN pnpm install --ignore-scripts
RUN cd artifacts/api-server && pnpm run build

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]