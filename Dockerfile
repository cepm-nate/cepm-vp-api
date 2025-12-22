# Lightweight Node base image
FROM node:20-alpine

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install production deps only
RUN npm ci --only=production

# Copy the rest of your app
COPY . .

# Expose the port your app listens on
EXPOSE 12980

# Run your app
CMD ["node", "cepm-vp-api.js"]
