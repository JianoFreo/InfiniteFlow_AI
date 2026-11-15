# Test image for the Python AI code. NOT deployed: in production this code runs inside the Java
# interpolation-worker container (services/interpolation-worker/Dockerfile), started per chunk.
#
#   docker build -t infiniteflow-engine-test services/interpolation-engine
#   docker run --rm infiniteflow-engine-test                      # run the test suite with real ffmpeg
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY app ./app
COPY tests ./tests

CMD ["python", "-m", "pytest", "-q"]
