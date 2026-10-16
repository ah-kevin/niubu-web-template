FROM node:24.16.0-alpine3.23@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 AS builder
WORKDIR /workspace
ENV SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 VITE_BACKEND_MOCK=0
RUN npm install --global --ignore-scripts pnpm@11.25.0
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts
ARG APP_NAME=@niubu/playground
RUN node internal/scripts/src/deployment.ts --app "$APP_NAME" --out /out --build

FROM nginx:stable-alpine3.23@sha256:0d3b80406a13a767339fbe2f41406d6c7da727ab89cf8fae399e81f780f814d1
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/lib/libstdc++.so.6* /usr/lib/
COPY --from=builder /usr/lib/libgcc_s.so.1 /usr/lib/
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /out/html /usr/share/nginx/html
COPY --from=builder /out/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /out/runtime /opt/template
COPY --chmod=0555 deploy/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 80
