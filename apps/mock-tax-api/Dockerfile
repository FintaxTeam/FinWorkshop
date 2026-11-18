FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/mock-tax-api/package*.json ./apps/mock-tax-api/
RUN npm install
COPY apps/mock-tax-api/ ./apps/mock-tax-api/
EXPOSE 4000
CMD ["npm", "--workspace", "apps/mock-tax-api", "start"]
