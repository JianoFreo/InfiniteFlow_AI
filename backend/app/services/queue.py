from redis import Redis
from rq import Queue

from app.core.config import settings


redis_conn = Redis.from_url(settings.redis_url)
video_queue = Queue(name=settings.queue_name, connection=redis_conn, default_timeout=60 * 30)
