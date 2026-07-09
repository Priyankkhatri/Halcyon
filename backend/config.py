"""
Halcyon Backend — Configuration & Settings
Loads from .env file using pydantic-settings.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # AI
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")

    # Server
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    debug: bool = Field(default=True, alias="DEBUG")

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./halcyon.db", alias="DATABASE_URL"
    )

    # Uploads
    max_upload_size_mb: int = Field(default=10, alias="MAX_UPLOAD_SIZE_MB")
    allowed_extensions: str = Field(
        default=".log,.txt,.out,.err", alias="ALLOWED_EXTENSIONS"
    )
    uploads_dir: str = Field(default="uploads", alias="UPLOADS_DIR")

    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def allowed_ext_set(self) -> set[str]:
        return {ext.strip() for ext in self.allowed_extensions.split(",")}


# Singleton instance
settings = Settings()

# Ensure uploads directory exists on startup
os.makedirs(settings.uploads_dir, exist_ok=True)
