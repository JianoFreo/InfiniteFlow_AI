# "core" on Railway: job-service + media-service + the Python engine in ONE container,
# because they share the /data volume and Railway can't share a volume between services.
# Used for deployment only. Docker Compose still builds the two services separately.
#   docker build -t infiniteflow-core services
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY job-service/pom.xml job-service/pom.xml
COPY job-service/src job-service/src
COPY media-service/pom.xml media-service/pom.xml
COPY media-service/src media-service/src
RUN mvn -q -B -DskipTests -f job-service/pom.xml package \
 && mvn -q -B -DskipTests -f media-service/pom.xml package

FROM eclipse-temurin:17-jre-noble
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*
COPY interpolation-engine/requirements.txt /opt/engine/requirements.txt
RUN python3 -m venv /opt/engine-venv \
 && /opt/engine-venv/bin/pip install --no-cache-dir -r /opt/engine/requirements.txt
COPY interpolation-engine/app /opt/engine/app
ENV ENGINE_PYTHON=/opt/engine-venv/bin/python ENGINE_DIR=/opt/engine \
    PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY --from=build /build/job-service/target/*.jar job.jar
COPY --from=build /build/media-service/target/*.jar media.jar
COPY start.sh start.sh
CMD ["bash", "start.sh"]