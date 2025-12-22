# Lightweight Node base image
FROM node:22-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install production deps only
RUN npm install --only=production

# Remove build dependencies to slim the image
RUN apk del python3 make g++

# Copy the rest of your app
COPY . .

# Expose the port your app listens on
EXPOSE 12980

# Run your app
CMD ["node", "cepm-vp-api.js"]
