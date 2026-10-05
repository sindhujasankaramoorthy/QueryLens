# Multi-stage Dockerfile for PSA01 Dataset Workbench
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and package.json files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd client && npm install
RUN cd server && npm install

# Copy application source
COPY . .

# Build production bundle for frontend
RUN npm run build

# Production image stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy node_modules & built assets
COPY --from=builder /app /app

EXPOSE 5000

CMD ["npm", "start"]
