"""
Shared email sending service.

Sends transactional emails through an SMTP server (Infomaniak by default)
using STARTTLS on port 587. All public helpers return a ``(success, error)``
tuple and never raise, so callers can treat email delivery as best-effort.
"""
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

from config import settings


def send_email(
    to_email: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """
    Send a single HTML email via the configured SMTP server.

    Returns ``(success, error_message)``. Never raises — the caller decides
    whether a delivery failure is blocking.
    """
    if not settings.smtp_host:
        return False, "SMTP_HOST non configuré"
    if not settings.smtp_user or not settings.smtp_password:
        return False, "Identifiants SMTP (SMTP_USER / SMTP_PASSWORD) non configurés"

    from_email = settings.smtp_from or settings.smtp_user

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.smtp_from_name, from_email))
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to

    # Plain-text fallback first, then HTML as the preferred alternative.
    msg.set_content(text or "Cet email nécessite un client compatible HTML.")
    msg.add_alternative(html, subtype="html")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls(context=context)
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True, None
    except smtplib.SMTPException as e:
        return False, f"SMTP: {e}"
    except Exception as e:
        return False, str(e)
