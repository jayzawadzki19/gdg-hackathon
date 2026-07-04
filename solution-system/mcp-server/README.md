# TRIZ MCP Server

A Model Context Protocol (MCP) server exposing [pytriz](https://github.com/mmysior/pytriz) TRIZ tools over Streamable HTTP.

## Run locally with uv

```bash
cp ../.env.example .env   # or create mcp-server/.env directly
uv sync
uv run python app/main.py
```

The server listens on `http://localhost:8000` (see `MCP_HOST` / `MCP_PORT` in `.env`).

## Run with Docker

From the repo root:

```bash
docker compose up --build
```

This builds the image from `mcp-server/Dockerfile` and exposes the server on `http://localhost:8000`.

To build/run the container directly instead:

```bash
cd mcp-server
docker build -t triz-mcp-server .
docker run --rm -p 8000:8000 --env-file ../.env triz-mcp-server
```

## Test with MCP Inspector

With the server running (locally or via Docker), launch the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector UI, connect using:

- **Transport:** Streamable HTTP
- **URL:** `http://localhost:8000/mcp`

You should see the registered tools (contradiction matrix lookup, parameter/principle search, etc.) and can invoke them directly from the UI.
