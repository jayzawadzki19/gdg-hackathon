# TRIZ MCP Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ADK agent use the existing TRIZ MCP server as its primary tool source.

**Architecture:** `agent.ts` will keep the existing Streamable HTTP MCP connection, remove the placeholder echo `FunctionTool`, and attach the `MCPToolset` directly to `rootAgent.tools`. The agent instruction will make the model behave as a TRIZ specialist and guide it toward the MCP tools already registered by the Python server.

**Tech Stack:** TypeScript, `@google/adk` `LlmAgent`, `MCPToolset`, Streamable HTTP MCP, Docker Compose.

---

## File Structure

- Modify `adg-agents/agent.ts`: Owns the ADK root agent definition and MCP toolset connection.
- No new source files.
- No package changes.
- No Nest API changes.
- No frontend changes.

## Task 1: Wire TRIZ MCP Toolset Into Root Agent

**Files:**
- Modify: `adg-agents/agent.ts`

- [ ] **Step 1: Replace the placeholder tool with MCP-only agent code**

Change `adg-agents/agent.ts` to this complete content:

```ts
import {
  LlmAgent,
  MCPToolset,
  type StreamableHTTPConnectionParams,
} from '@google/adk';

const mcpUrl = process.env.MCP_SERVER_URL ?? 'http://localhost:8000/mcp';

const connectionParams: StreamableHTTPConnectionParams = {
  type: 'StreamableHTTPConnectionParams',
  url: mcpUrl,
};

const trizToolset = new MCPToolset(connectionParams);

const trizInstruction = `
You are BuildWithAI, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving).

Your job is to solve technical contradictions by identifying the improving parameter and the worsening or preserving parameter, querying the TRIZ MCP tools, and translating abstract Inventive Principles into concrete recommendations.

Use the available MCP tools this way:
1. If the user describes a contradiction but does not provide TRIZ parameter IDs, call search_parameter to find likely TRIZ engineering parameters.
2. Once you have improving and preserving parameter IDs, call browse_contradiction_matrix.
3. Use get_parameter_by_id or get_principle_by_id when you need exact details for a selected parameter or principle.
4. Use search_principle when the user asks about a concept, pattern, or principle directly.
5. Use get_random_principles only when the user explicitly asks for inspiration or brainstorming.

When answering, structure the response as:
- Contradiction
- Selected Parameters
- Found Principles
- Actionable Technical Solutions

Keep solutions practical, specific to the user's technical context, and avoid pretending you used TRIZ data when a required MCP tool call failed.
`;

export const rootAgent = new LlmAgent({
  name: 'root_agent',
  model: 'gemini-2.5-flash',
  instruction: trizInstruction,
  tools: [trizToolset],
});
```

- [ ] **Step 2: Verify static load of the agent module**

Run from `adg-agents`:

```bash
node --import tsx ./agent.ts
```

Expected: command exits with code `0`. If `tsx` is unavailable, use the existing ADK dev server verification in Step 3 instead, because the package currently has no TypeScript compile script.

- [ ] **Step 3: Rebuild the composed services**

Run from `solution-system`:

```bash
docker compose up --build
```

Expected:
- `mcp-server` starts on port `8000`.
- `adk-agent` starts on port `8081`.
- `api` starts on port `3000`.
- The agent container receives `MCP_SERVER_URL=http://mcp-server:8000/mcp`.

- [ ] **Step 4: Exercise the agent through the Nest API**

With the stack running, send:

```bash
curl -sS http://localhost:3000/api/agent/messages \
  -H 'Content-Type: application/json' \
  -d '{"message":"Use TRIZ to solve this contradiction: I want a web chat UI to feel instant, but preserving backend cost means I cannot call the LLM on every keystroke."}'
```

Expected:
- JSON response includes `sessionId`.
- JSON response `text` is not an echo of the prompt.
- The answer contains TRIZ-style sections: `Contradiction`, `Selected Parameters`, `Found Principles`, and `Actionable Technical Solutions`.
- The answer references selected parameters and principles returned by the MCP tools.

- [ ] **Step 5: Check edited file diagnostics**

Run linter diagnostics for `adg-agents/agent.ts`.

Expected: no new TypeScript diagnostics in the edited file.

## Self-Review

- Spec coverage: The plan wires `MCP_SERVER_URL`, keeps Streamable HTTP, attaches `MCPToolset` to `rootAgent.tools`, removes the echo tool, and updates the instruction for TRIZ specialist behavior.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: The plan uses `StreamableHTTPConnectionParams`, `MCPToolset`, and `LlmAgent` exactly as provided by installed `@google/adk` types.
- Commit handling: No commit step is included because this session must not create git commits unless the user explicitly asks.
