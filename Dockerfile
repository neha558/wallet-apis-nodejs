FROM node:16.16.0-slim
WORKDIR /app
COPY . .
RUN apt update
RUN npm install
EXPOSE 3008
CMD ["npm", "start", "prod"]
