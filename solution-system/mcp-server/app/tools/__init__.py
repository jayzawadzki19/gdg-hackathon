from mcp.server.fastmcp import FastMCP

from app.tools.contradictions import (
    browse_contradiction_matrix,
    get_parameter_by_id,
    get_principle_by_id,
    get_random_principles,
    search_parameter,
    search_principle,
)

tools = [
    # Data / retrieval
    browse_contradiction_matrix,
    search_parameter,
    search_principle,
    get_random_principles,
    get_principle_by_id,
    get_parameter_by_id,
]


def register(mcp: FastMCP) -> None:
    for tool in tools:
        mcp.tool()(tool)
