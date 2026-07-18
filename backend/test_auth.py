"""Tests for the API token gate."""
from main import _requires_token


def test_no_token_configured_disables_auth():
    assert _requires_token("POST", "/api/weights", None) is False
    assert _requires_token("DELETE", "/api/rawtimes", None) is False


def test_reads_are_open_even_with_token():
    assert _requires_token("GET", "/api/weights", "s3cret") is False
    assert _requires_token("HEAD", "/api/analysis", "s3cret") is False


def test_cors_preflight_is_open():
    assert _requires_token("OPTIONS", "/api/weights", "s3cret") is False


def test_mutations_require_token():
    assert _requires_token("POST", "/api/analysis", "s3cret") is True
    assert _requires_token("PUT", "/api/weights", "s3cret") is True
    assert _requires_token("DELETE", "/api/rawtimes", "s3cret") is True
    assert _requires_token("POST", "/api/atg/some/path", "s3cret") is True


def test_non_api_paths_are_open():
    assert _requires_token("POST", "/index.html", "s3cret") is False
