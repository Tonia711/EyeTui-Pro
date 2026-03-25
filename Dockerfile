# =============================================
# Frontend Dockerfile for EyeTui
# Multi-stage build: Node for building, Nginx for serving
# =============================================

# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the frontend source
COPY . .

# Create .env for production build (use /api/ for Nginx proxy)
RUN echo "VITE_API_BASE_URL=/api" > .env

# Build the production bundle (Vite reads from .env)
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom nginx configuration
# Copy custom nginx configuration template
COPY nginx/templates/default.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Create SSL directory (certificates mounted at runtime)
RUN mkdir -p /etc/nginx/ssl

# Expose ports 80 (HTTP redirect) and 443 (HTTPS)
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
