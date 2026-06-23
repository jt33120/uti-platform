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


# ── Shared branded email template ──────────────────────────────────
# Every transactional email is rendered through render_email_html() so they
# all share the same shell: logo, "Groupement-IT" wordmark, card layout and
# footer. Callers only provide the inner content (title + body + optional CTA).
BRAND = "Groupement-IT"


def _logo_url() -> str:
    return f"{settings.frontend_url.rstrip('/')}/logo.png"


def render_email_html(
    *,
    title: str,
    body_html: str,
    cta: Optional[dict] = None,
    footer_note: Optional[str] = None,
) -> str:
    """
    Render a branded HTML email.

    - ``title``       : H1 shown under the logo (e.g. "Bonjour Jean,").
    - ``body_html``   : inner HTML of the main block (paragraphs, tables…).
    - ``cta``         : optional ``{"label", "url"}`` → black button + copyable link.
    - ``footer_note`` : optional small grey note in the bottom (bordered) row.
    """
    cta_html = ""
    if cta:
        cta_html = f"""
            <tr>
              <td align="center" style="padding:0 32px 32px;">
                <a href="{cta['url']}"
                   style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
                  {cta['label']}
                </a>
                <p style="font-size:12px;color:#86868b;margin:20px 0 0;word-break:break-all;">
                  Ou copiez ce lien :<br/>
                  <span style="color:#1d1d1f;">{cta['url']}</span>
                </p>
              </td>
            </tr>"""

    footer_html = ""
    if footer_note:
        footer_html = f"""
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e5e5e7;font-size:12px;color:#86868b;">
                {footer_note}
              </td>
            </tr>"""

    return f"""\
<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e5e7;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <img src="{_logo_url()}" alt="{BRAND}" height="36" style="height:36px;width:auto;display:block;margin:0 0 12px;" />
                <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#6e6e73;font-weight:600;">{BRAND}</div>
                <h1 style="font-size:22px;margin:8px 0 0;font-weight:600;">{title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;font-size:15px;line-height:1.55;color:#1d1d1f;">
                {body_html}
              </td>
            </tr>{cta_html}{footer_html}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""



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
