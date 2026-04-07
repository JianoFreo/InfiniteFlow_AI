import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://app:app@db:5432/interp")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_NAME = os.getenv("QUEUE_NAME", "video")
FILE_ROOT = os.getenv("FILE_ROOT", "/data")
UPLOADS_DIR = os.path.join(FILE_ROOT, "uploads")
OUTPUTS_DIR = os.path.join(FILE_ROOT, "outputs")
TMP_DIR = os.path.join(FILE_ROOT, "tmp")
