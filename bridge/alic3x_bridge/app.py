"""Local HTTP API for driving Live directly from the studio machine.

Bound to 127.0.0.1 only. Useful for step-1 testing without the backend, and as
the future low-latency fast path.
"""

from __future__ import annotations

from typing import Any

from fastapi import Body, FastAPI, HTTPException

from .live import LiveAdapter
from .tools import TOOLS, ToolError, run_tool, snapshot
from .uplink import Uplink


def create_app(live: LiveAdapter, uplink: Uplink | None = None) -> FastAPI:
    app = FastAPI(title="Alic3X OSC Bridge")

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "ok": True,
            "uplink": None if uplink is None else {"connected": uplink.connected},
        }

    @app.get("/tools")
    async def tools() -> dict[str, Any]:
        return {"tools": {name: model.model_json_schema() for name, (model, _) in TOOLS.items()}}

    @app.get("/state")
    async def state() -> dict[str, Any]:
        try:
            return await snapshot(live)
        except Exception as e:  # Live offline: report the cache instead of a 500
            return {"cached": live.state, "error": str(e)}

    @app.post("/tools/{tool}")
    async def invoke(tool: str, args: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
        try:
            return {"ok": True, "result": await run_tool(live, tool, args)}
        except ToolError as e:
            raise HTTPException(status_code=404 if tool not in TOOLS else 422, detail=str(e)) from None

    return app
