# ==============================
# Stage 1: Builder
# ==============================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite build — menghasilkan folder dist/
RUN npm run build

# ==============================
# Stage 2: Nginx (serve static)
# ==============================
FROM nginx:alpine

# Hapus default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy hasil build dari stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy konfigurasi nginx custom (untuk SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
