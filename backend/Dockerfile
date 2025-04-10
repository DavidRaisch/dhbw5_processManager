FROM node:16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV PORT=5001
ENV MONGODB_URI=mongodb://mongo:27017/bpmn

EXPOSE 5001

CMD ["node", "index.js"]