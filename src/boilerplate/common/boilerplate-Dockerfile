FROM node:18.19

WORKDIR /app

COPY ./package.json ./package-lock.json ./
RUN npm i
COPY config ./config

EXPOSE 3000

CMD ["node", "orchestration/api.mjs"]