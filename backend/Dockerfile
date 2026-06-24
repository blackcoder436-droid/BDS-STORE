# ============================================
# BDS STORE VPN Backend - Dockerfile
# Multi-stage build with Node 20 Alpine
# ============================================

# --- Stage 1: Build dependencies ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# --- Stage 2: Production image ---
FROM node:20-alpine AS production

# Security: Add non-root user
# လုံခြုံရေး: root မဟုတ်သော user ဖန်တီးခြင်း
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY package.json ./
COPY src/ ./src/

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 3000

# Health check - verify the server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Start the application
CMD ["node", "src/server.js"]
