"""Tests for SPA static-file path resolution (traversal protection)."""
from main import _resolve_within


def test_serves_file_inside_base(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "app.js").write_text("ok")

    assert _resolve_within(dist, "app.js") == (dist / "app.js").resolve()


def test_serves_nested_file_inside_base(tmp_path):
    dist = tmp_path / "dist"
    (dist / "img").mkdir(parents=True)
    (dist / "img" / "logo.png").write_bytes(b"png")

    assert _resolve_within(dist, "img/logo.png") == (dist / "img" / "logo.png").resolve()


def test_rejects_parent_traversal(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (tmp_path / "secret.txt").write_text("secret")

    assert _resolve_within(dist, "../secret.txt") is None


def test_rejects_deep_traversal_to_existing_file(tmp_path):
    dist = tmp_path / "dist"
    (dist / "img").mkdir(parents=True)
    (tmp_path / "secret.txt").write_text("secret")

    assert _resolve_within(dist, "img/../../secret.txt") is None


def test_rejects_absolute_path(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("secret")

    assert _resolve_within(dist, str(outside)) is None


def test_missing_file_returns_none(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()

    assert _resolve_within(dist, "nope.js") is None


def test_directory_returns_none(tmp_path):
    dist = tmp_path / "dist"
    (dist / "img").mkdir(parents=True)

    assert _resolve_within(dist, "img") is None
