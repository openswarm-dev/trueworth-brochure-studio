# Brochure Studio: Node app + Chromium (for PDF export) in one image.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    BROWSER_PATH=/usr/bin/chromium \
    HOST=0.0.0.0 \
    PORT=10000

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 10000
CMD ["node", "server/index.js"]
