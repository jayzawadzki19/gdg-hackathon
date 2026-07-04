# TRIZ MCP Agent Integration - Design

**Date:** 2026-07-04
**Status:** Approved
**Scope:** Integrate the existing TRIZ MCP server (`mcp-server`) into the ADK agent (`adg-agents`) so the agent acts as a TRIZ specialist and can call the MCP tools over Streamable HTTP.

## Context

- The MCP server exposes TRIZ tools through FastMCP at `/mcp`.
- `docker-compose.yml` already wires the agent container to the MCP server with `MCP_SERVER_URL=http://mcp-server:8000/mcp`.
- `agent.ts` already constructs an `MCPToolset`, but the exported `rootAgent` currently uses only the local placeholder `get_response_for_question` tool.
- Installed `@google/adk` types confirm `LlmAgent` accepts `ToolUnion[]`, where `ToolUnion` is `BaseTool | BaseToolset`, and `MCPToolset` extends `BaseToolset`.

## Architecture

The ADK agent will connect to the MCP server through one `MCPToolset`:

- Read `MCP_SERVER_URL` from the environment.
- Fall back to `http://localhost:8000/mcp` for local non-Docker usage.
- Use `StreamableHTTPConnectionParams` with the existing URL.
- Attach the `MCPToolset` directly to `rootAgent.tools`.

The placeholder `FunctionTool` will be removed because it echoes user input and can distract the model from the TRIZ workflow.

## Agent Behavior

The agent will be positioned as a TRIZ engineering contradiction specialist.

Its instruction will tell it to:

- Identify the user's improving and worsening/preserving engineering parameters.
- Use `search_parameter` when parameter IDs are unclear.
- Use `browse_contradiction_matrix` once it has the improving and preserving parameter IDs.
- Optionally use `search_principle`, `get_principle_by_id`, `get_parameter_by_id`, or `get_random_principles` when the user asks for principle or parameter exploration.
- Translate abstract TRIZ principles into concrete, stack-aware recommendations.
- Return a structured answer with the contradiction, selected parameters, found principles, and actionable technical solutions.

## Error Handling

The MCP server already returns human-readable error strings from its tools. The agent should surface useful tool results naturally in its response.

If the MCP server is unreachable, ADK will fail tool execution. No fallback fake TRIZ answer will be added in `agent.ts`; failing clearly is better than presenting unsupported guidance.

## Testing

Verification will focus on runtime integration:

- Build or type-check the agent package if a local script is available.
- Run the composed stack.
- Send a contradiction-style prompt through the existing Nest API or ADK endpoint.
- Confirm the response uses MCP-backed TRIZ tools rather than the removed echo tool.

## Out of Scope

- Adding new MCP tools.
- Exposing MCP tools as explicit Nest API endpoints.
- Persisting MCP sessions or tool results.
- Changing the frontend chat UI.
