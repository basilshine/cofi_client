FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/poka-ne-zabyl/package.json apps/poka-ne-zabyl/package.json
RUN npm ci --workspace apps/poka-ne-zabyl --include-workspace-root=false --ignore-scripts

COPY apps/poka-ne-zabyl apps/poka-ne-zabyl
RUN npm run build --workspace apps/poka-ne-zabyl

FROM nginx:alpine

COPY apps/poka-ne-zabyl/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/poka-ne-zabyl/dist /usr/share/nginx/html
RUN nginx -t
