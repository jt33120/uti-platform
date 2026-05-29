from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    openai_api_key: Optional[str] = None
    openrouter_key: Optional[str] = None
    jwt_secret: str = "change-me-in-production"
    frontend_url: str = "https://git-alpha-hazel.vercel.app"
    resend_key: Optional[str] = None
    resend_from: str = "UTI Group <onboarding@resend.dev>"

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
    }

settings = Settings()
