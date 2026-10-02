FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
COPY frontend/lib/types.ts /app/frontend/lib/types.ts
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
