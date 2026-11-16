FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/mock-tax-api/package*.json ./apps/mock-tax-api/
RUN npm install --workspace=apps/mock-tax-api --omit=dev
COPY apps/mock-tax-api/ ./apps/mock-tax-api/
EXPOSE 4000
WORKDIR /app/apps/mock-tax-api
CMD ["node", "src/server.js"]
