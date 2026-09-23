FROM python:3.11-slim

# Prevent Python from writing pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY app/ ./app
COPY pytest.ini .

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE ${PORT}

# Run production ASGI server with gunicorn + uvicorn workers (1 worker, 4 threads, 120s timeout for resource constrained hosts)
CMD exec gunicorn -w 1 --threads 4 -k uvicorn.workers.UvicornWorker --timeout 120 app.main:app --bind 0.0.0.0:${PORT}
