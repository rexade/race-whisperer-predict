# Stage 1: Build the frontend
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# This image serves FastAPI and the frontend from the same origin.
ENV VITE_PERSISTENCE_API_ENABLED=true
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=builder /app/dist dist/
EXPOSE 8000
# Supply API_TOKEN and DATABASE_URL at runtime, preferably with --env-file.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
