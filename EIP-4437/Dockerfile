FROM node:20-alpine

WORKDIR /app

# Install git (required for some Hardhat dependencies)
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies as root
RUN npm install

# Copy project files
COPY . .

# Change ownership to node user
RUN chown -R node:node /app

# Switch to node user
USER node

# Expose Hardhat network port
EXPOSE 8545

# Keep container running (we'll manually run hardhat commands)
CMD ["tail", "-f", "/dev/null"]
