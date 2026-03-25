import importlib
import sys


def _fresh_import(name: str):
    if name in sys.modules:
        del sys.modules[name]
    return importlib.import_module(name)


def test_lib_path_helper__windows_no_paths(monkeypatch):
    import os
    import platform

    monkeypatch.setattr(platform, "system", lambda: "Windows")
    monkeypatch.setattr(os.path, "exists", lambda _p: False)
    monkeypatch.setenv("PATH", "X")

    mod = _fresh_import("app.lib_path_helper")
    assert mod.setup_library_paths() is False
    assert os.environ["PATH"].startswith("X")


def test_lib_path_helper__macos_sets_env(monkeypatch):
    import os
    import platform
    from pathlib import Path

    monkeypatch.setattr(platform, "system", lambda: "Darwin")
    monkeypatch.delenv("DYLD_LIBRARY_PATH", raising=False)
    monkeypatch.delenv("LIBRARY_PATH", raising=False)

    def _exists(p: str) -> bool:
        return p == "/opt/homebrew/lib"

    monkeypatch.setattr(os.path, "exists", _exists)

    # Simulate that dylib exists in that directory
    orig_glob = Path.glob

    def _glob(self: Path, pattern: str):
        if str(self) == "/opt/homebrew/lib" and pattern.startswith("libzbar"):
            return [Path("/opt/homebrew/lib/libzbar.dylib")]
        return list(orig_glob(self, pattern))

    monkeypatch.setattr(Path, "glob", _glob)

    mod = _fresh_import("app.lib_path_helper")
    assert mod.setup_library_paths() is True
    assert os.environ["DYLD_LIBRARY_PATH"].startswith("/opt/homebrew/lib")
    assert os.environ["LIBRARY_PATH"].startswith("/opt/homebrew/lib")


def test_lib_path_helper__linux_sets_ld_library_path(monkeypatch):
    import os
    import platform
    from pathlib import Path

    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.delenv("LD_LIBRARY_PATH", raising=False)

    def _exists(p: str) -> bool:
        return p == "/usr/lib"

    monkeypatch.setattr(os.path, "exists", _exists)

    orig_glob = Path.glob

    def _glob(self: Path, pattern: str):
        if str(self) == "/usr/lib" and pattern.startswith("libzbar.so"):
            return [Path("/usr/lib/libzbar.so.0")]
        return list(orig_glob(self, pattern))

    monkeypatch.setattr(Path, "glob", _glob)

    mod = _fresh_import("app.lib_path_helper")
    assert mod.setup_library_paths() is True
    assert os.environ["LD_LIBRARY_PATH"].startswith("/usr/lib")


def test_lib_path_helper__windows_sets_path_when_found(monkeypatch):
    import os
    import platform
    from pathlib import Path

    monkeypatch.setattr(platform, "system", lambda: "Windows")
    monkeypatch.setenv("PATH", "BASE")

    def _exists(p: str) -> bool:
        return p == r"C:\zbar\bin"

    monkeypatch.setattr(os.path, "exists", _exists)

    orig_glob = Path.glob

    def _glob(self: Path, pattern: str):
        if str(self) == r"C:\zbar\bin" and pattern.startswith("libzbar"):
            return [Path(r"C:\zbar\bin\libzbar-64.dll")]
        return list(orig_glob(self, pattern))

    monkeypatch.setattr(Path, "glob", _glob)

    mod = _fresh_import("app.lib_path_helper")
    assert mod.setup_library_paths() is True
    assert os.environ["PATH"].startswith(r"C:\zbar\bin;")


def test_lib_path_helper__macos_prints_found_zbar_line(monkeypatch, capsys):
    """
    Hit the specific 'Found ZBar library at:' print line (previously uncovered).
    """
    import os
    import platform
    from pathlib import Path

    monkeypatch.setattr(platform, "system", lambda: "Darwin")

    def _exists(p: str) -> bool:
        return p == "/usr/local/lib"

    monkeypatch.setattr(os.path, "exists", _exists)

    orig_glob = Path.glob

    def _glob(self: Path, pattern: str):
        # On Windows, Path("/usr/local/lib") may render as "\usr\local\lib".
        if self.as_posix().endswith("/usr/local/lib") and pattern.startswith("libzbar"):
            return [Path("/usr/local/lib/libzbar.dylib")]
        return list(orig_glob(self, pattern))

    monkeypatch.setattr(Path, "glob", _glob)

    mod = _fresh_import("app.lib_path_helper")
    assert mod.setup_library_paths() is True

    out = capsys.readouterr().out
    assert "Found ZBar library at" in out


