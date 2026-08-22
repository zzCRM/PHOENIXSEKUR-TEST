FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget openssl
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev --ignore-scripts && npx prisma generate
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p uploads
EXPOSE 3001
CMD ["npm", "start"]
