# Build stage
FROM node:16 AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
# Copy your custom nginx config file to override the default config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy build files from previous stage
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
