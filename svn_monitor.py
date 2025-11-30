import os
import subprocess
import sys
import time
import logging
from datetime import datetime
from typing import Optional

import requests

# -------------------------------- Configuration --------------------------------
# Root directory of the SVN working copy you want to monitor.
# Defaults to the directory that contains this script. Override with env var SVN_DIR.
SVN_DIR: str = os.getenv('SVN_DIR', os.path.abspath(os.path.dirname(__file__)))

# Interval (seconds) between checks for new revisions (env override: SVN_POLL_INTERVAL)
POLL_INTERVAL: int = int(os.getenv('SVN_POLL_INTERVAL', '30'))

# Health-check URL that should respond with HTTP 200 when the Flask app is healthy.
# Override with env var HEALTH_URL. Keep it lightweight – e.g. "/" or "/scores".
HEALTH_URL: str = os.getenv('HEALTH_URL', 'http://172.18.67.143:11452/')

# Timeout (seconds) for the health-check HTTP GET request.
HEALTH_TIMEOUT: int = int(os.getenv('HEALTH_TIMEOUT', '5'))

# Number of consecutive failed health-checks allowed after an update before we
# automatically roll back to the previous revision. Zero disables rollback.
MAX_HEALTH_FAILS: int = int(os.getenv('MAX_HEALTH_FAILS', '3'))

# Log file path (env override: SVN_MONITOR_LOG). Uses rotating logs via the
# built-in `logging.handlers.RotatingFileHandler` to avoid uncontrolled growth.
LOG_PATH: str = os.getenv('SVN_MONITOR_LOG', os.path.join(SVN_DIR, 'svn_monitor.log'))
LOG_MAX_BYTES: int = int(os.getenv('SVN_MONITOR_LOG_MAX', str(5 * 1024 * 1024)))  # 5 MB
LOG_BACKUP_COUNT: int = int(os.getenv('SVN_MONITOR_LOG_BACKUP', '5'))


# ------------------------------ Logging setup ----------------------------------
from logging.handlers import RotatingFileHandler  # noqa: E402 (after import guard)

logger = logging.getLogger('svn_monitor')
logger.setLevel(logging.INFO)
_handler = RotatingFileHandler(LOG_PATH, maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUP_COUNT, encoding='utf-8')
_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s', '%Y-%m-%d %H:%M:%S'))
logger.addHandler(_handler)
logger.propagate = False


# ------------------------------- Helpers ---------------------------------------

class SVNError(RuntimeError):
    """Raised when an svn command fails."""


def _run(cmd: list[str], cwd: Optional[str] = None) -> str:
    """Run command and return stdout as str. Raises SVNError on non-zero exit."""
    try:
        res = subprocess.run(cmd, cwd=cwd or SVN_DIR, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        logger.error('Command failed (%s): %s', e.returncode, ' '.join(cmd))
        logger.error('stdout: %s', e.stdout)
        logger.error('stderr: %s', e.stderr)
        raise SVNError(f"Command {' '.join(cmd)} failed") from e


def get_revision(rev_spec: str | None = None) -> int:
    """Return the integer revision number for the given rev-spec (default: working copy)."""
    cmd = ['svn', 'info', '--show-item', 'revision']
    if rev_spec:
        cmd.extend(['-r', rev_spec])
    out = _run(cmd)
    try:
        return int(out)
    except ValueError:
        raise SVNError(f'Unexpected svn info output: {out!r}')


def svn_update(revision: str | None = None) -> None:
    """Run `svn update` (optionally to a specific revision)."""
    cmd = ['svn', 'update']
    if revision:
        cmd.extend(['-r', str(revision)])
    _run(cmd)


def health_ok() -> bool:
    """Return True if the Flask app responds with 200 OK; False otherwise."""
    try:
        resp = requests.get(HEALTH_URL, timeout=HEALTH_TIMEOUT)
        return resp.status_code == 200
    except Exception as e:
        logger.warning('Health-check failed: %s', e)
        return False


# ----------------------------- Main monitor loop -------------------------------

def main():
    logger.info('SVN monitor started. Watching %s; polling every %ss', SVN_DIR, POLL_INTERVAL)

    # Ensure working copy exists
    if not os.path.isdir(os.path.join(SVN_DIR, '.svn')):
        logger.error('Directory %s is not an SVN working copy – aborting.', SVN_DIR)
        sys.exit(1)

    prev_local_rev = get_revision()
    logger.info('Initial working-copy revision: %s', prev_local_rev)

    while True:
        try:
            remote_rev = get_revision('HEAD')
            if remote_rev > prev_local_rev:
                logger.info('New revision detected: %s (local %s). Updating…', remote_rev, prev_local_rev)
                svn_update()  # update to HEAD

                # Health-check the Flask app after update
                fails = 0
                if MAX_HEALTH_FAILS > 0:
                    while not health_ok():
                        fails += 1
                        if fails >= MAX_HEALTH_FAILS:
                            logger.error('Health-check failed %s times after update – rolling back to r%s', fails, prev_local_rev)
                            svn_update(str(prev_local_rev))
                            # After rollback, wait a bit for reloader to pick up changes, then reset fails counter.
                            time.sleep(5)
                            break
                        time.sleep(2)
                else:
                    logger.debug('Health-check disabled (MAX_HEALTH_FAILS=0)')

                # Update prev_local_rev if health is ok (or rollback disabled)
                current_rev = get_revision()
                prev_local_rev = current_rev
                logger.info('Now at working-copy revision: %s', current_rev)

        except SVNError:
            # Already logged; continue loop.
            pass
        except Exception:
            logger.exception('Unexpected error in monitor loop')

        time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info('SVN monitor stopped by user')
        print('\nStopped.') 