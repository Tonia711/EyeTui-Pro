import os


def pytest_configure():
    """
    Test-suite bootstrap.

    The production code imports `app.database` at module import time and requires
    `DATABASE_URL` to exist. For unit tests we provide a safe default so imports
    don't crash on machines without a .env.
    """
    os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./_pytest_backend.sqlite")


