# Use Node.js 22-slim image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y openssl

# Copy package files AND prisma schema folder
COPY package*.json ./
COPY prisma ./prisma

# Install Node.js dependencies
RUN npm install --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the source code
COPY . ./

# Build the app (NestJS -> dist/)
RUN npm run build

# Expose the port that the application listens on.
EXPOSE 5005

# Run the application.
CMD ["npm", "run", "start:dev"]
