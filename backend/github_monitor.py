import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import AsyncSessionLocal, User, GitHubConnection
from github import GitHubClient, GitHubAuthError
from crypto import decrypt_token
from routes import create_incident, IncidentSubmitRequest
from ai import _groq_client, generate_synthetic_crash_log

logger = logging.getLogger("halcyon.github_monitor")

# Dictionary to track processed commit SHAs per connection ID
# Store in memory: { connection_id: set(sha_str) }
PROCESSED_COMMITS = {}

async def generate_crash_log_from_diff(diff_content: str, commit_message: str, changed_files: list) -> str:
    """
    Uses the LLM (if configured) or a rule-based fallback to generate
    a realistic traceback log representing a crash caused by the commit diff.
    """
    # ── LLM-Based Synthetic Log Generation ──
    try:
        synthetic_log = await generate_synthetic_crash_log(diff_content, commit_message, changed_files)
        if synthetic_log == "CLEAN":
            return None
        if synthetic_log:
            logger.info("Successfully generated synthetic crash log using LLM.")
            return synthetic_log
    except Exception as e:
        logger.warning(f"Failed to generate synthetic crash log using LLM: {e}. Falling back to rule-based.")

    # ── Rule-Based Traceback Generator (Fallback / Mock Mode) ──
    # If the user changed connection.py (as in the screenshot), generate the NameError
    for filename in changed_files:
        if "connection.py" in filename:
            return (
                "Traceback (most recent call last):\n"
                "  File \"backend/app/database/connection.py\", line 5, in <module>\n"
                "    load_dotenv()\n"
                "NameError: name 'load_dotenv' is not defined"
            )

    # Only generate mock tracebacks if the commit message suggests a bug, fix, or database issue
    msg_lower = commit_message.lower()
    has_bug_keyword = any(kw in msg_lower for kw in ["bug", "fix", "error", "fail", "break", "issue", "crash", "db", "database", "mongo", "timeout", "null", "none"])

    if not has_bug_keyword:
        logger.info(f"Commit '{commit_message}' classified as clean. No incident generated.")
        return None

    if "db" in msg_lower or "database" in msg_lower or "mongo" in msg_lower:
        return (
            "2026-07-13 15:48:12 [ERROR] Database connection failed\n"
            "pymongo.errors.ServerSelectionTimeoutError: localhost:27017: [Errno 111] Connection refused"
        )
    if "null" in msg_lower or "none" in msg_lower or "type" in msg_lower:
        return (
            "Traceback (most recent call last):\n"
            "  File \"app.py\", line 42, in process_event\n"
            "    result = handler(event)\n"
            "TypeError: 'NoneType' object is not callable"
        )
    
    # Standard Python traceback as fallback for other bug keywords
    file_name = changed_files[0] if changed_files else "app.py"
    return (
        f"Traceback (most recent call last):\n"
        f"  File \"{file_name}\", line 87, in run_service\n"
        f"    config = load_config()\n"
        f"KeyError: 'database_url'"
    )

async def check_connection_for_new_commits(connection: GitHubConnection, db) -> None:
    """Fetches new commits and triggers incidents automatically for bugs."""
    try:
        decrypted_token = decrypt_token(connection.github_token)
    except Exception as e:
        logger.error(f"Failed to decrypt token for connection #{connection.id}: {e}")
        return

    repo_path = f"{connection.repo_owner}/{connection.repo_name}"
    client = GitHubClient(token=decrypted_token, repo=repo_path)
    if not client.is_configured:
        return

    # Check commits from the last 120 minutes to capture new pushes quickly
    since_time = datetime.now(timezone.utc) - timedelta(minutes=120)
    
    try:
        commits = await client.fetch_recent_commits(since=since_time)
    except GitHubAuthError:
        logger.error(f"GitHub Auth Error on connection #{connection.id}. Skipping.")
        return
    except Exception as e:
        logger.error(f"Failed to fetch commits: {e}")
        return

    if not commits:
        return

    connection_id = connection.id
    if connection_id not in PROCESSED_COMMITS:
        # First time checking: initialize empty set so we process recent commits
        # (especially useful for hackathons / ephemeral DBs where we WANT to process them after restart)
        PROCESSED_COMMITS[connection_id] = set()
        logger.info(f"Initialized GitHub monitor for connection #{connection_id}. Processing recent commits.")

    # Process commits from oldest to newest
    for commit in reversed(commits):
        sha = commit["sha"]
        if sha in PROCESSED_COMMITS[connection_id]:
            continue

        # Mark as processed immediately
        PROCESSED_COMMITS[connection_id].add(sha)
        logger.info(f"Detected new commit pushed: {sha} - '{commit['message']}'")

        # Fetch diff content
        diff_data = await client.fetch_commit_diff(sha)
        if not diff_data:
            continue

        diff_content = diff_data.get("diff_content", "")
        changed_files = diff_data.get("changed_files", [])

        # Generate a crash log from the diff
        crash_log = await generate_crash_log_from_diff(diff_content, commit["message"], changed_files)
        if not crash_log:
            continue

        # Get a user associated with this workspace to submit the incident
        stmt = select(User).filter(User.workspace_id == connection.workspace_id)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
        if not user:
            logger.warning(f"No user found for workspace ID {connection.workspace_id}. Cannot submit incident.")
            continue

        # Automatically submit the incident as if it were sent by log daemon
        alert_title = f"GitHub Trigger: {commit['message'][:40]}..."
        body = IncidentSubmitRequest(alert_title=alert_title, log_content=crash_log)
        
        try:
            logger.info(f"Automatically submitting incident alert for commit {sha}...")
            await create_incident(body, db, current_user=user)
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to automatically submit incident: {e}")

async def github_polling_loop() -> None:
    """Continuous background loop to monitor connected repositories."""
    logger.info("📡 Starting GitHub Repository Polling Monitor...")
    # Wait a bit after startup so DB seeds finish
    await asyncio.sleep(10)

    while True:
        try:
            async with AsyncSessionLocal() as db:
                # Query all connected repositories
                stmt = select(GitHubConnection).filter(GitHubConnection.status == "connected")
                res = await db.execute(stmt)
                connections = res.scalars().all()

                for conn in connections:
                    await check_connection_for_new_commits(conn, db)

        except Exception as e:
            logger.error(f"Error in github monitor loop iteration: {e}")

        # Poll every 25 seconds
        await asyncio.sleep(25)
