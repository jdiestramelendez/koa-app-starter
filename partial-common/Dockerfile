FROM node:11.4-alpine AS builder

# copy all content
COPY . .

# create the dist folder
RUN dos2unix create-dist.sh && chmod +x create-dist.sh && ./create-dist.sh
WORKDIR /dist

# install all dependencies
RUN npm install --prod

FROM builder as run

# NOTE: it seems that node program only works at root. TODO: This needs to be fixed to make it more robust
COPY --from=builder /dist ./

# install pino-papertrail globally so it can be accessed when piping
# RUN npm install --production -g pino-papertrail

# expose needed port
EXPOSE ${API_PORT}

# set node to run in production mode
ENV NODE_ENV=production

# ARG papertrail_dest=xxx
# ARG papertrail_port=xxx
# ARG papertrail_app=xxx

# ENV variables: API_PORT, LOG_LEVEL, RUN_ENV
ENTRYPOINT node index.js --port ${API_PORT} --loglevel ${LOG_LEVEL} --env ${RUN_ENV}
    # | pino-papertrail --host ${papertrail_dest} --port ${papertrail_port} --appname ${papertrail_app}
