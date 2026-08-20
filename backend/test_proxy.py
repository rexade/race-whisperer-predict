"""Tests for the outbound ATG API boundary."""
from fastapi.testclient import TestClient

import main


client = TestClient(main.app, raise_server_exceptions=False)


class _FakeResponse:
    content = b"{}"
    status_code = 200
    headers = {"content-type": "application/json"}


class _FakeAsyncClient:
    requested_urls = []

    def __init__(self, **_kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def request(self, **kwargs):
        self.requested_urls.append(kwargs["url"])
        return _FakeResponse()


def test_proxy_forwards_raw_query_string(monkeypatch):
    _FakeAsyncClient.requested_urls = []
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClient)

    response = client.get("/api/atg/races?date=2026-08-20&track=Solvalla%20Main")

    assert response.status_code == 200
    assert len(_FakeAsyncClient.requested_urls) == 1
    assert str(_FakeAsyncClient.requested_urls[0]) == (
        "https://www.atg.se/services/racinginfo/v1/api/races"
        "?date=2026-08-20&track=Solvalla%20Main"
    )


def test_proxy_rejects_encoded_dot_segment_escape(monkeypatch):
    _FakeAsyncClient.requested_urls = []
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClient)

    response = client.get(
        "/api/atg/%2e%2e/%2e%2e/%2e%2e/%2e%2e/robots.txt"
    )

    assert response.status_code == 400
    assert _FakeAsyncClient.requested_urls == []


def test_proxy_rejects_double_encoded_dot_segments(monkeypatch):
    _FakeAsyncClient.requested_urls = []
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClient)

    response = client.get("/api/atg/%252e%252e/%252e%252e/account")

    assert response.status_code == 400
    assert _FakeAsyncClient.requested_urls == []


def test_proxy_rejects_deeply_encoded_dot_segments(monkeypatch):
    _FakeAsyncClient.requested_urls = []
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClient)

    response = client.get(
        "/api/atg/%252525252e%252525252e/%252525252e%252525252e/account"
    )

    assert response.status_code == 400
    assert _FakeAsyncClient.requested_urls == []


def test_proxy_rejects_del_control_character(monkeypatch):
    _FakeAsyncClient.requested_urls = []
    monkeypatch.setattr(main.httpx, "AsyncClient", _FakeAsyncClient)

    response = client.get("/api/atg/races/%7f/account")

    assert response.status_code == 400
    assert _FakeAsyncClient.requested_urls == []
