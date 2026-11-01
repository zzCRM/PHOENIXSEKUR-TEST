# Production build — Phoenix Sekur frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY base44-export/package.json base44-export/package-lock.json ./
RUN npm ci
COPY base44-export/ ./
COPY shared /shared
ARG VITE_VITRINE_URL=https://www.phoenixsekur.com
ENV VITE_USE_OWN_API=true
ENV VITE_VITRINE_URL=$VITE_VITRINE_URL
RUN npm run build

FROM nginx:alpine
COPY base44-export/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
