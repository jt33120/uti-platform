"""
Storage abstraction over Supabase Storage and OVH Object Storage (S3-compatible).

The active backend is selected by ``settings.storage_backend``:
  - "supabase" (default) — keeps using Supabase Storage. Nothing changes.
  - "s3"               — uses OVH Object Storage via the S3 API (boto3).

Call sites use logical bucket names ("cvs", "avatars"). For S3 these are
mapped to key prefixes inside a single OVH bucket, so the application code
stays identical regardless of the backend.
"""
from typing import Optional

from config import settings
from services.supabase_client import supabase

_s3_client = None


def _use_s3() -> bool:
    return settings.storage_backend == "s3"


def _s3():
    """Lazily build a boto3 S3 client (only imported when S3 is actually used)."""
    global _s3_client
    if _s3_client is None:
        import boto3  # imported lazily so Supabase-only deploys don't need boto3

        _s3_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
        )
    return _s3_client


def get_public_url(bucket: str, path: str) -> str:
    if _use_s3():
        base = (settings.s3_public_base_url or "").rstrip("/")
        return f"{base}/{bucket}/{path}"
    return supabase.storage.from_(bucket).get_public_url(path)


def upload(bucket: str, path: str, content: bytes, content_type: str) -> str:
    """Upload bytes and return the object's public URL."""
    if _use_s3():
        _s3().put_object(
            Bucket=settings.s3_bucket,
            Key=f"{bucket}/{path}",
            Body=content,
            ContentType=content_type,
            ACL="public-read",
        )
    else:
        supabase.storage.from_(bucket).upload(path, content, {"content-type": content_type})
    return get_public_url(bucket, path)


def remove(bucket: str, paths: list[str]) -> None:
    if not paths:
        return
    if _use_s3():
        _s3().delete_objects(
            Bucket=settings.s3_bucket,
            Delete={"Objects": [{"Key": f"{bucket}/{p}"} for p in paths]},
        )
    else:
        supabase.storage.from_(bucket).remove(paths)


def list(bucket: str, prefix: str) -> list[dict]:
    """List objects under ``prefix``. Returns dicts with at least a ``name`` key."""
    if _use_s3():
        full_prefix = f"{bucket}/{prefix.rstrip('/')}/"
        resp = _s3().list_objects_v2(Bucket=settings.s3_bucket, Prefix=full_prefix)
        return [{"name": obj["Key"].split("/")[-1]} for obj in resp.get("Contents", [])]
    return supabase.storage.from_(bucket).list(prefix)
