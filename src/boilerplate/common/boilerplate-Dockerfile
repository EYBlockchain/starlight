FROM node:12.18

WORKDIR /app


COPY ./package.json ./package-lock.json ./
RUN npm ci
EXPOSE 3000
