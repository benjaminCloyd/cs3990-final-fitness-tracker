import logging
from datetime import datetime
from pathlib import Path

# ── configuration ─────────────────────────────────────────────────────────────

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"

# Configure standard Python logging to both disk and console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("ironlog")


# ── core logic ────────────────────────────────────────────────────────────────


def log_event(event_type: str, message: str, username: str = "system"):
    """
    Persist a structured event log with a timestamp and user context.
    """
    log_msg = f"{username} | {event_type} | {message}"
    logger.info(log_msg)


def get_recent_logs(limit: int = 100):
    """
    Retrieve the most recent lines from the application log file.
    """
    if not LOG_FILE.exists():
        return []
    with open(LOG_FILE, "r") as f:
        lines = f.readlines()
        return lines[-limit:]
