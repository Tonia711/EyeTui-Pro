import runpy
from pathlib import Path

import pytest


def test_database__missing_database_url_raises(monkeypatch):
    """
    Cover the guardrail in app/database.py when DATABASE_URL is missing.
    We execute the module file in isolation so we don't disturb the already-imported
    app.database module used by other tests.
    """
    monkeypatch.delenv("DATABASE_URL", raising=False)

    # app/database.py calls load_dotenv() which might populate DATABASE_URL from a local
    # .env file on the machine running tests. Stub it to keep this test deterministic.
    import sys
    import types

    fake_dotenv = types.ModuleType("dotenv")
    fake_dotenv.load_dotenv = lambda *args, **kwargs: None  # type: ignore[assignment]
    sys.modules["dotenv"] = fake_dotenv

    db_path = Path(__file__).resolve().parents[1] / "app" / "database.py"
    try:
        with pytest.raises(RuntimeError, match="DATABASE_URL is not set"):
            runpy.run_path(str(db_path))
    finally:
        sys.modules.pop("dotenv", None)


