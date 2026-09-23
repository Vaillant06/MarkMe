import pytest
from app.config import settings

@pytest.fixture(autouse=True)
def enable_test_dev_mode(monkeypatch):
    """
    Ensures unit and integration tests run with DEV_MODE=True so that
    offline mock workbook flows and mock sessions can run reliably
    regardless of local environment settings.
    """
    monkeypatch.setattr(settings, "DEV_MODE", True)
