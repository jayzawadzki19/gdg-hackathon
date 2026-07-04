from mcp.server.fastmcp import FastMCP

from app.resources.example import read_data

# Add your resources here — URI pattern + handler.
resources: list[tuple[str, object]] = [
    ("data://{name}", read_data),
    # ("myservice://items/{id}", my_resource),
]


def register(mcp: FastMCP) -> None:
    for uri, handler in resources:
        mcp.resource(uri)(handler)
