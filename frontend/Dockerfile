# Step 1: Build React app
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json vite.config.ts index.html ./
RUN npm install

COPY src/ ./src/
RUN npm run build

# Step 2: Serve React app with Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
