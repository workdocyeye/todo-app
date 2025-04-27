# Stage 1: Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Stage 2: Runtime Stage
FROM node:18-alpine AS runner

WORKDIR /app

# Copy only necessary artifacts from the build stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

# Expose the application port
EXPOSE 3001

# Set environment to production
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "server.js"] 