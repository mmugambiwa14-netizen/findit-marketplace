FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY scripts ./scripts

ENV NODE_ENV=production
ENV FINDIT_TOUR_PROCESSOR_BATCH_SIZE=5

USER node

CMD ["sh", "-c", "while true; do node scripts/tour-processing-runner.mjs --batch-size ${FINDIT_TOUR_PROCESSOR_BATCH_SIZE}; sleep ${PEEKALISTING_WORKER_POLL_SECONDS:-5}; done"]
