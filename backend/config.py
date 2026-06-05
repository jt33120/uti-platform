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

    # File storage backend: "supabase" (default) or "s3" (OVH Object Storage)
    storage_backend: str = "supabase"
    s3_endpoint_url: Optional[str] = None  # e.g. https://s3.gra.io.cloud.ovh.net
    s3_region: str = "gra"
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_bucket: Optional[str] = None  # single OVH bucket; "cvs"/"avatars" become key prefixes
    s3_public_base_url: Optional[str] = None  # public base URL for stored objects

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
    }

settings = Settings()
