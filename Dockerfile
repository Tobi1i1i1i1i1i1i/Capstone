# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.22.0

FROM node:${NODE_VERSION}-alpine

# Install Python3 for the Flask ML service
RUN apk add --no-cache python3 py3-pip

# Use production node environment by default.
ENV NODE_ENV production

WORKDIR /usr/src/app

# ── Node.js dependencies ──────────────────────────────────────────────────────
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ── Python dependencies ───────────────────────────────────────────────────────
COPY ml/requirements.txt /tmp/ml-requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/ml-requirements.txt

# ── Application source ────────────────────────────────────────────────────────
COPY . .
RUN chmod -R 777 uploads

# Run the application as a non-root user.
USER node

# ── Startup script: Flask (background) + Node.js (foreground) ─────────────────
EXPOSE 3000 5000

CMD sh -c "cd /usr/src/app/ml && gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 60 app:app & npm run dev"
