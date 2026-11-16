FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/middleware-api/package*.json ./apps/middleware-api/
RUN npm install --workspace=apps/middleware-api --omit=dev
COPY apps/middleware-api/ ./apps/middleware-api/
EXPOSE 3001
WORKDIR /app/apps/middleware-api
CMD ["node", "src/server.js"]
