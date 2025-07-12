FROM node:20-alpine

WORKDIR /app

COPY . .

RUN npm install --legacy-peer-deps

CMD ["npm", "run", "dev"]