FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web-client/package*.json ./apps/web-client/
RUN npm install
COPY apps/web-client/ ./apps/web-client/
RUN npm --workspace apps/web-client run build

FROM nginx:alpine
COPY --from=builder /app/apps/web-client/dist /usr/share/nginx/html
COPY apps/web-client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
