FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p uploads
EXPOSE 3001
CMD ["npm", "start"]
