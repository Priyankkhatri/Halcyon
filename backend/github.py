import logging
import httpx
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from config import settings

logger = logging.getLogger(__name__)

class GitHubAuthError(Exception):
    """Raised when GitHub API authentication fails (401, 403)."""
    pass

class GitHubClient:
    def __init__(self, token: Optional[str] = None, repo: Optional[str] = None):
        self.token = token or settings.github_token
        self.repo = repo or settings.github_repo
        self.base_url = "https://api.github.com"
        
    @property
    def is_configured(self) -> bool:
        return bool(self.repo)

    async def verify_connection(self) -> bool:
        """Make a lightweight API call to verify connection settings."""
        if not self.token or not self.repo:
            return False
        if self.token.startswith("mock_") or self.token == "dummy":
            return True
        parts = self.repo.strip().split("/")
        if len(parts) != 2:
            return False
        owner, repo_name = parts
        url = f"{self.base_url}/repos/{owner}/{repo_name}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, headers=self._get_headers())
                return response.status_code == 200
        except Exception:
            return False

    def _get_headers(self) -> dict:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def fetch_recent_commits(self, since: datetime) -> List[Dict[str, Any]]:
        """
        Fetch commits from the configured repository within the lookback window.
        Returns:
            [ { "sha": ..., "author": ..., "timestamp": ..., "message": ... } ]
        """
        if not self.is_configured:
            logger.warning("GitHub client is not configured (GITHUB_REPO is missing).")
            return []

        parts = self.repo.strip().split("/")
        if len(parts) != 2:
            logger.warning(f"Invalid GITHUB_REPO format: '{self.repo}'. Expected 'owner/repo'.")
            return []
        
        owner, repo_name = parts
        since_iso = since.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        url = f"{self.base_url}/repos/{owner}/{repo_name}/commits"
        params = {"since": since_iso}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, headers=self._get_headers(), params=params)
                if response.status_code in (401, 403):
                    raise GitHubAuthError(f"Authentication failed: {response.text}")
                if response.status_code != 200:
                    logger.error(f"GitHub API returned status {response.status_code}: {response.text}")
                    return []
                
                commits_data = response.json()
                if not isinstance(commits_data, list):
                    return []

                results = []
                for item in commits_data:
                    sha = item.get("sha", "")
                    commit_obj = item.get("commit", {})
                    author_obj = commit_obj.get("author", {})
                    
                    results.append({
                        "sha": sha,
                        "author": author_obj.get("name", "Unknown"),
                        "timestamp": author_obj.get("date", ""),
                        "message": commit_obj.get("message", "No message"),
                    })
                return results
        except GitHubAuthError:
            raise
        except Exception as exc:
            logger.error(f"Failed to fetch commits from GitHub: {exc}")
            return []

    async def fetch_commit_diff(self, sha: str) -> Optional[Dict[str, Any]]:
        """
        Fetch changed files and diff patches for a given commit.
        Returns:
            { "changed_files": [...], "diff_content": "..." } or None
        """
        if not self.is_configured:
            return None

        parts = self.repo.strip().split("/")
        if len(parts) != 2:
            return None
        
        owner, repo_name = parts
        url = f"{self.base_url}/repos/{owner}/{repo_name}/commits/{sha}"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, headers=self._get_headers())
                if response.status_code in (401, 403):
                    raise GitHubAuthError(f"Authentication failed for commit {sha}")
                if response.status_code != 200:
                    logger.error(f"GitHub API returned status {response.status_code} for commit {sha}")
                    return None
                
                data = response.json()
                files = data.get("files", [])
                
                changed_files = []
                diff_parts = []
                
                for f in files:
                    filename = f.get("filename", "unknown")
                    changed_files.append(filename)
                    
                    patch = f.get("patch", "")
                    if patch:
                        diff_parts.append(f"File: {filename}\n{patch}\n")
                
                return {
                    "changed_files": changed_files,
                    "diff_content": "\n".join(diff_parts)
                }
        except GitHubAuthError:
            raise
        except Exception as exc:
            logger.error(f"Failed to fetch commit diff for {sha}: {exc}")
            return None
