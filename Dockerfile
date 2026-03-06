# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.22.0

# Switch to slim (Debian) — Alpine's musl libc breaks numpy/scikit-learn builds
FROM node:${NODE_VERSION}-slim

# Install Python3 for the Flask ML service
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Use production node environment by default.
ENV NODE_ENV production

WORKDIR /usr/src/app

# ── Node.js dependencies ──────────────────────────────────────────────────────
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ── Python dependencies (isolated venv) ───────────────────────────────────────
COPY ml/requirements.txt /tmp/ml-requirements.txt
RUN python3 -m venv /opt/mlenv && \
    /opt/mlenv/bin/pip install --no-cache-dir -r /tmp/ml-requirements.txt

# ── Application source ────────────────────────────────────────────────────────
COPY . .
RUN chmod -R 777 uploads

# Run the application as a non-root user.
USER node

# ── Startup: Flask ML API (background) + Node.js (foreground) ─────────────────
EXPOSE 3000 5000

CMD sh -c "cd /usr/src/app/ml && /opt/mlenv/bin/gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 60 app:app & npm run dev"
