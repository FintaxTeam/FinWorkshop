FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/middleware-api/package*.json ./apps/middleware-api/
RUN npm install
COPY apps/middleware-api/ ./apps/middleware-api/
EXPOSE 3001
CMD ["npm", "--workspace", "apps/middleware-api", "start"]
