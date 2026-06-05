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
    admin_email: Optional[str] = None  # recipient for support/contact notifications

    # SMTP (Infomaniak) — transactional email delivery
    smtp_host: str = "mail.infomaniak.com"
    smtp_port: int = 587  # STARTTLS
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None  # defaults to smtp_user when unset
    smtp_from_name: str = "UTI Group"

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
    }

settings = Settings()
