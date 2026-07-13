import logging
from cryptography.fernet import Fernet
from config import settings

logger = logging.getLogger(__name__)

# Fallback default key for local development only if GITHUB_ENCRYPTION_KEY is not set
DEFAULT_DEV_KEY = b"O7ZYNZXhK26r4CtVn4delXmRWumGeER1LkTlQVSDy2o="

def _get_fernet() -> Fernet:
    key_str = settings.github_encryption_key
    if not key_str:
        logger.warning("GITHUB_ENCRYPTION_KEY is not configured. Using local dev fallback key.")
        return Fernet(DEFAULT_DEV_KEY)
    
    try:
        return Fernet(key_str.encode())
    except Exception as e:
        logger.error(f"Invalid GITHUB_ENCRYPTION_KEY format: {e}. Falling back to dev key.")
        return Fernet(DEFAULT_DEV_KEY)

def encrypt_token(token: str) -> str:
    """Encrypt a plaintext token to a secure at-rest ciphertext string."""
    if not token:
        return ""
    f = _get_fernet()
    return f.encrypt(token.encode("utf-8")).decode("utf-8")

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt an at-rest ciphertext string back to the plaintext token."""
    if not encrypted_token:
        return ""
    f = _get_fernet()
    try:
        return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to decrypt token: {e}")
        return ""
