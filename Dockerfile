# Use Node.js 24-slim image
FROM node:24-slim

# Enable corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package, lock file & prisma folder
COPY package.json pnpm-lock.yaml prisma ./ 

# Install dependencies
RUN pnpm install

# Copy rest of the project files
COPY . .

# Build the app (NestJS -> dist/)
RUN pnpm build

# Expose the port
EXPOSE 5010

CMD ["pnpm", "run", "start"]
