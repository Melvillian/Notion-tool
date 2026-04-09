FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN mkdir -p data
CMD ["bun", "run", "src/index.ts"]
