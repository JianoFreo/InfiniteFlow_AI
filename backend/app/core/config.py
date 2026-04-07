from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "InfiniteFlow API"
    app_env: str = "production"
    app_debug: bool = False
    api_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg://app:app@db:5432/interp"
    redis_url: str = "redis://redis:6379/0"
    queue_name: str = "video"

    file_root: str = "/data"
    uploads_subdir: str = "uploads"
    outputs_subdir: str = "outputs"

    @property
    def uploads_dir(self) -> str:
        return f"{self.file_root}/{self.uploads_subdir}"

    @property
    def outputs_dir(self) -> str:
        return f"{self.file_root}/{self.outputs_subdir}"


settings = Settings()
