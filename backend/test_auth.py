"""Tests for the API token gate."""
from fastapi.testclient import TestClient

import main
from main import _requires_token


client = TestClient(main.app, raise_server_exceptions=False)


def test_mutations_always_require_token():
    assert _requires_token("POST", "/api/weights") is True
    assert _requires_token("DELETE", "/api/rawtimes") is True


def test_normal_reads_are_open():
    assert _requires_token("GET", "/api/weights") is False
    assert _requires_token("HEAD", "/api/analysis") is False


def test_debug_reads_require_token():
    assert _requires_token("GET", "/api/debug/races/r1/rawtimes-unfiltered") is True
    assert _requires_token("HEAD", "/api/debug/races/r1/rawtimes-unfiltered") is True


def test_cors_preflight_is_open():
    assert _requires_token("OPTIONS", "/api/weights") is False
    assert _requires_token("OPTIONS", "/api/debug/races/r1/rawtimes-unfiltered") is False


def test_non_api_paths_are_open():
    assert _requires_token("POST", "/index.html") is False


def test_unconfigured_server_fails_closed(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", None)

    response = client.post("/api/analysis", json={})

    assert response.status_code == 503
    assert response.json()["detail"] == "API token authentication is not configured"


def test_missing_or_invalid_token_is_rejected(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "configured-test-token")

    missing = client.post("/api/analysis", json={})
    invalid = client.post(
        "/api/analysis",
        json={},
        headers={"X-Api-Token": "wrong-test-token"},
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401


def test_valid_token_reaches_request_validation(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "configured-test-token")

    response = client.post(
        "/api/analysis",
        json={},
        headers={"X-Api-Token": "configured-test-token"},
    )

    assert response.status_code == 422


def test_debug_route_is_protected(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "configured-test-token")

    response = client.get("/api/debug/races/r1/rawtimes-unfiltered")

    assert response.status_code == 401


def test_routes_under_asgi_root_path_remain_protected(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "configured-test-token")
    mounted_client = TestClient(
        main.app,
        root_path="/race-whisperer",
        raise_server_exceptions=False,
    )

    mutation = mounted_client.post("/race-whisperer/api/analysis", json={})
    debug_read = mounted_client.get(
        "/race-whisperer/api/debug/races/r1/rawtimes-unfiltered"
    )
    route_relative_mutation = mounted_client.post("/api/analysis", json={})
    authenticated_mutation = mounted_client.post(
        "/race-whisperer/api/analysis",
        json={},
        headers={"X-Api-Token": "configured-test-token"},
    )
    authenticated_route_relative_mutation = mounted_client.post(
        "/api/analysis",
        json={},
        headers={"X-Api-Token": "configured-test-token"},
    )

    assert mutation.status_code == 401
    assert debug_read.status_code == 401
    assert route_relative_mutation.status_code == 401
    assert authenticated_mutation.status_code == 422
    assert authenticated_route_relative_mutation.status_code == 422


def test_non_ascii_token_header_is_rejected_without_server_error(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "configured-test-token")

    response = client.post(
        "/api/analysis",
        json={},
        headers=[(b"x-api-token", b"\xff")],
    )

    assert response.status_code == 401
