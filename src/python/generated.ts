// Auto-generated Python bridge script
// Generated at: 2026-04-13T04:12:48.437Z
// Source: src/python/bridge.py
//
// Do not edit manually. Run: luca build-python-bridge

export const bridgeScript = `#!/usr/bin/env python3
"""Luca Python Bridge - persistent interactive Python session.

Communicates via JSON lines over stdin/stdout. Each request is a single
JSON object per line on stdin; each response is a single JSON object per
line on stdout. User print() output is captured per-execution via
io.StringIO so it never corrupts the protocol.

Python 3.8+ compatible (stdlib only).
"""
import sys
import json
import io
import traceback
import os

# Persistent namespace shared across all exec/eval calls
_namespace = {"__builtins__": __builtins__}


def setup_sys_path(project_dir):
    """Insert project_dir and common sub-paths into sys.path."""
    paths_to_add = [project_dir]

    # src/ layout (PEP 621 / setuptools)
    src_dir = os.path.join(project_dir, "src")
    if os.path.isdir(src_dir):
        paths_to_add.append(src_dir)

    # lib/ layout (less common but exists)
    lib_dir = os.path.join(project_dir, "lib")
    if os.path.isdir(lib_dir):
        paths_to_add.append(lib_dir)

    for p in reversed(paths_to_add):
        if p not in sys.path:
            sys.path.insert(0, p)


def _safe_serialize(value):
    """Attempt JSON serialization; fall back to repr()."""
    try:
        json.dumps(value, default=str)
        return value
    except (TypeError, ValueError, OverflowError):
        return repr(value)


def handle_exec(req):
    """Execute code in the persistent namespace."""
    code = req.get("code", "")
    variables = req.get("variables", {})
    _namespace.update(variables)

    old_stdout = sys.stdout
    captured = io.StringIO()
    sys.stdout = captured
    try:
        exec(code, _namespace)
        sys.stdout = old_stdout
        return {"ok": True, "stdout": captured.getvalue(), "result": None}
    except Exception as e:
        sys.stdout = old_stdout
        return {
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "stdout": captured.getvalue(),
        }


def handle_eval(req):
    """Evaluate an expression and return its value."""
    expression = req.get("expression", "")

    old_stdout = sys.stdout
    captured = io.StringIO()
    sys.stdout = captured
    try:
        result = eval(expression, _namespace)
        sys.stdout = old_stdout
        return {
            "ok": True,
            "result": _safe_serialize(result),
            "stdout": captured.getvalue(),
        }
    except Exception as e:
        sys.stdout = old_stdout
        return {
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "stdout": captured.getvalue(),
        }


def handle_import(req):
    """Import a module into the namespace."""
    module_name = req.get("module", "")
    alias = req.get("alias", module_name.split(".")[-1])
    try:
        mod = __import__(
            module_name,
            fromlist=[module_name.split(".")[-1]] if "." in module_name else [],
        )
        _namespace[alias] = mod
        return {"ok": True, "result": "Imported {} as {}".format(module_name, alias)}
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }


def handle_call(req):
    """Call a function by dotted path in the namespace."""
    func_path = req.get("function", "")
    args = req.get("args", [])
    kwargs = req.get("kwargs", {})

    old_stdout = sys.stdout
    captured = io.StringIO()
    sys.stdout = captured
    try:
        parts = func_path.split(".")
        obj = _namespace[parts[0]]
        for part in parts[1:]:
            obj = getattr(obj, part)
        result = obj(*args, **kwargs)
        sys.stdout = old_stdout
        return {
            "ok": True,
            "result": _safe_serialize(result),
            "stdout": captured.getvalue(),
        }
    except Exception as e:
        sys.stdout = old_stdout
        return {
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "stdout": captured.getvalue(),
        }


def handle_get_locals(req):
    """Return all non-dunder keys from the namespace."""
    safe = {}
    for k, v in _namespace.items():
        if k.startswith("__"):
            continue
        safe[k] = _safe_serialize(v)
    return {"ok": True, "result": safe}


def handle_reset(req):
    """Clear the namespace."""
    _namespace.clear()
    _namespace["__builtins__"] = __builtins__
    return {"ok": True, "result": "Session reset"}


HANDLERS = {
    "exec": handle_exec,
    "eval": handle_eval,
    "import": handle_import,
    "call": handle_call,
    "get_locals": handle_get_locals,
    "reset": handle_reset,
}


def main():
    # First line from stdin is the init handshake with project_dir
    init_line = sys.stdin.readline().strip()
    if init_line:
        try:
            init = json.loads(init_line)
            if "project_dir" in init:
                setup_sys_path(init["project_dir"])
        except json.JSONDecodeError:
            pass

    # Signal ready
    sys.stdout.write(json.dumps({"ok": True, "type": "ready"}) + "\\n")
    sys.stdout.flush()

    # Main loop: read JSON commands, execute, respond
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            resp = {"ok": False, "error": "Invalid JSON: {}".format(e)}
            sys.stdout.write(json.dumps(resp) + "\\n")
            sys.stdout.flush()
            continue

        req_id = req.get("id")
        req_type = req.get("type", "exec")
        handler = HANDLERS.get(req_type)

        if not handler:
            resp = {"ok": False, "error": "Unknown request type: {}".format(req_type)}
        else:
            resp = handler(req)

        if req_id:
            resp["id"] = req_id

        sys.stdout.write(json.dumps(resp, default=str) + "\\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
`
