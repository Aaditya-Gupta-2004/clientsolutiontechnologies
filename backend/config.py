from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@localhost:5432/projectportal"
    secret_key: str = "change-me-in-production-super-secret-key-32chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    razorpay_key_id: str = "rzp_test_placeholder"
    razorpay_key_secret: str = "rzp_secret_placeholder"

    app_name: str = "Solution Technologies Project Portal"
    storage_path: str = "./storage"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
