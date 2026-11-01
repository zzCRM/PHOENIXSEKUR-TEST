FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget openssl
COPY backend/package.json backend/package-lock.json* ./
COPY backend/prisma ./prisma
RUN npm install --omit=dev --ignore-scripts && npx prisma generate
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/docker-entrypoint.sh ./
COPY shared /shared
RUN mkdir -p uploads && chmod +x docker-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
