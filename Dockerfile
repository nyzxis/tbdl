FROM oven/bun:1-alpine

WORKDIR /app

# Copy dependency definition
COPY package.json tsconfig.json ./

# Install dependencies
RUN bun install --production

# Copy application files
COPY src ./src
COPY public ./public

ENV PORT=5000
EXPOSE 5000

CMD ["bun", "run", "src/index.ts"]
