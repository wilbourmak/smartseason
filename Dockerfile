# Use the official Node.js 18 image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY backend/ ./

# Set environment to production
ENV NODE_ENV=production

# Cloud Run sets PORT environment variable
# Our app already uses process.env.PORT
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the server (using simple test server)
CMD ["node", "server-simple.js"]
