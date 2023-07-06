FROM node:16.17

WORKDIR /app


COPY ./package.json ./package-lock.json ./
RUN npm ci
EXPOSE 3000
