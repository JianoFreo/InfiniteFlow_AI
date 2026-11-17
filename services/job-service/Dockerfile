# job-service = Java service + the Python AI code it runs for every chunk.
# Built from services/ (see infra/docker-compose.yml) so it can copy both directories:
#   docker build -f services/job-service/Dockerfile services
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY job-service/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY job-service/src ./src
RUN mvn -q -B -DskipTests package

# Pinned to Ubuntu 24.04 (noble) for Python 3.12, the version the engine is tested on
# (services/interpolation-engine/Dockerfile). The plain 17-jre tag moved to Ubuntu 26.04 / Python 3.14,
# for which the pinned NumPy has no prebuilt wheel.
FROM eclipse-temurin:17-jre-noble
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Python: only NumPy, in its own venv. No web framework, no queue client, no DB driver.
COPY interpolation-engine/requirements.txt /opt/engine/requirements.txt
RUN python3 -m venv /opt/engine-venv \
    && /opt/engine-venv/bin/pip install --no-cache-dir -r /opt/engine/requirements.txt
COPY interpolation-engine/app /opt/engine/app

ENV ENGINE_PYTHON=/opt/engine-venv/bin/python \
    ENGINE_DIR=/opt/engine \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-jar", "app.jar"]
