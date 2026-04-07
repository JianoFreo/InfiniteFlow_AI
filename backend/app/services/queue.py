from redis import Redis
from rq import Queue
from rq.job import Retry

from app.core.config import settings


redis_conn = Redis.from_url(settings.redis_url)
video_queue = Queue(name=settings.queue_name, connection=redis_conn, default_timeout=60 * 30)
retry_policy = Retry(max=2, interval=[10, 30])
