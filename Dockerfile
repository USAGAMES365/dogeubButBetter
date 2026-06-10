# syntax=docker/dockerfile:1.6

########################
# 1) Build stage
########################
# Use full Debian-based Node image for builds (has more tooling available)
FROM node:20-bookworm AS build
WORKDIR /app

# Install deps (cached layer)
COPY package*.json ./
RUN npm ci

# Copy source and build frontend
COPY . .
RUN npm run build

########################
# 2) Runtime stage (Debian slim)
########################
# Slim runtime image (Debian bookworm-slim variant)
FROM node:20-bookworm-slim AS runtime

# Create the app directory and set ownership to the 'node' user immediately
RUN mkdir -p /app && chown -R node:node /app
WORKDIR /app

ENV NODE_ENV=production
# DogeUB documents PORT via env in copy.env
ENV PORT=3000

# Switch to the non-root 'node' user BEFORE performing file operations
USER node

# Install only production deps (with explicit node user ownership)
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy only what runtime needs, ensuring 'node' owns them:
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/server.js ./server.js
COPY --from=build --chown=node:node /app/stealth-proxy.js ./stealth-proxy.js

# Optional files seen in repo root (safe to include)
COPY --from=build --chown=node:node /app/masqr.js ./masqr.js
COPY --from=build --chown=node:node /app/Checkfailed.html ./Checkfailed.html
COPY --from=build --chown=node:node /app/placeholder.svg ./placeholder.svg

EXPOSE 3000
CMD ["node", "server.js"]
