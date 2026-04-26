FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m appuser && mkdir -p /app && chown -R appuser:appuser /app
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY --chown=appuser:appuser . .

# Create directories for secrets and models
RUN mkdir -p /app/secrets /app/models && chown -R appuser:appuser /app/secrets /app/models

USER appuser

EXPOSE 8000

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
