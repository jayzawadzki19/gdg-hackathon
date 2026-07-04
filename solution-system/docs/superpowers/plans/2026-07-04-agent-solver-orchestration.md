# Agent Solver Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ADK solving pipeline that extracts the core problem, runs TRIZ and five-ways solvers in parallel, then returns evaluated and ranked solutions.

**Architecture:** Replace the single TRIZ-only `LlmAgent` export with a `SequentialAgent` root workflow. The workflow saves intermediate outputs to session state with `outputKey`, runs TRIZ and five-ways agents through a `ParallelAgent`, and lets a final evaluator read both solver outputs to produce the user-facing ranking.

**Tech Stack:** TypeScript, `@google/adk` `LlmAgent`, `SequentialAgent`, `ParallelAgent`, `MCPToolset`, Streamable HTTP MCP, Bun, Docker Compose.

---

## File Structure

- Modify `adg-agents/agent.ts`: Owns the ADK root agent definition, MCP connection, specialized sub-agent instructions, parallel solver stage, and final sequential workflow export.
- No new source files.
- No package changes.
- No Nest API changes.
- No frontend changes.

## Task 1: Replace Single TRIZ Agent With Workflow Agents

**Files:**
- Modify: `adg-agents/agent.ts`

- [ ] **Step 1: Replace `agent.ts` with the workflow implementation**

Change `adg-agents/agent.ts` to this complete content:

```ts
import {
  LlmAgent,
  MCPToolset,
  ParallelAgent,
  SequentialAgent,
  type StreamableHTTPConnectionParams,
} from '@google/adk';

const model = 'gemini-2.5-flash';
const mcpUrl = process.env.MCP_SERVER_URL ?? 'http://localhost:8000/mcp';

const connectionParams: StreamableHTTPConnectionParams = {
  type: 'StreamableHTTPConnectionParams',
  url: mcpUrl,
};

const trizToolset = new MCPToolset(connectionParams);

const problemExtractorInstruction = `
You are a precise problem-framing agent.

Your job is to extract the core problem from the user's request so specialist solver agents can solve the right thing.

Return only this structure:
# Core Problem
A one-sentence statement of the real problem to solve.

# Key Constraints
- The concrete constraints that shape acceptable solutions.

# Success Criteria
- The signals that would make a solution successful.

Preserve domain-specific details. Remove incidental wording, examples that do not affect the solution, and emotional phrasing.
`;

const trizInstruction = `
You are BuildWithAI-TRIZ, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving).

Solve the extracted problem stored in {core_problem}.

Your job is to solve technical contradictions by identifying the improving parameter and the worsening or preserving parameter, querying the TRIZ MCP tools, and translating abstract Inventive Principles into concrete recommendations.

Use the available MCP tools this way:
1. If the extracted problem describes a contradiction but does not provide TRIZ parameter IDs, call search_parameter to find likely TRIZ engineering parameters.
2. Once you have improving and preserving parameter IDs, call browse_contradiction_matrix.
3. Use get_parameter_by_id or get_principle_by_id when you need exact details for a selected parameter or principle.
4. Use search_principle when the problem points to a concept, pattern, or principle directly.
5. Use get_random_principles only when the extracted problem explicitly needs broad inspiration.

Return candidate solutions in this structure:
# TRIZ Candidates
## Candidate: concise title
Source: TRIZ
Principles Used: principle names or IDs when available
Solution: concrete implementation idea
Benefits: practical upside
Risks: practical trade-offs

Keep solutions practical, specific to the user's technical context, and avoid pretending you used TRIZ data when a required MCP tool call failed.
`;

const fiveWaysInstruction = `
You are BuildWithAI-FiveWays, a pragmatic problem-solving agent.

Solve the extracted problem stored in {core_problem}.

Generate exactly five meaningfully different candidate solutions using these angles:
1. Simplify the problem.
2. Decompose the problem.
3. Automate or delegate part of the work.
4. Invert the assumption behind the problem.
5. Reuse existing resources, constraints, or feedback loops.

Return candidate solutions in this structure:
# Five-Ways Candidates
## Candidate: concise title
Source: Five-Ways
Angle: one of the five angles
Solution: concrete implementation idea
Benefits: practical upside
Risks: practical trade-offs

Keep all five candidates specific to the extracted problem and avoid generic advice.
`;

const solutionEvaluatorInstruction = `
You are BuildWithAI-Evaluator, a strict solution evaluation agent.

Evaluate the extracted problem and solver outputs:

Core problem:
{core_problem}

TRIZ output:
{triz_solutions}

Five-ways output:
{five_way_solutions}

Merge overlapping candidates, preserve the strongest version of each idea, and rank the final candidates.

Score each candidate from 1 to 10 using:
- Feasibility
- Impact
- Cost
- Risk
- Clarity

Return only this user-facing structure:
# Ranked Solutions

## 1. concise solution title
Score: n/10
Source: TRIZ, Five-Ways, or Both
Pros: short practical benefits
Cons: short risks or trade-offs
Why it ranks here: concrete evaluation rationale

Repeat the numbered section for each valuable candidate. Favor the best solutions over listing weak filler. If TRIZ tool usage failed or one solver produced no useful candidates, briefly mention that after the ranked list.
`;

const problemExtractorAgent = new LlmAgent({
  name: 'problem_extractor',
  model,
  instruction: problemExtractorInstruction,
  outputKey: 'core_problem',
});

const trizAgent = new LlmAgent({
  name: 'triz_solver',
  model,
  instruction: trizInstruction,
  tools: [trizToolset],
  outputKey: 'triz_solutions',
});

const fiveWaysAgent = new LlmAgent({
  name: 'five_ways_solver',
  model,
  instruction: fiveWaysInstruction,
  outputKey: 'five_way_solutions',
});

const solutionGeneratorsAgent = new ParallelAgent({
  name: 'solution_generators',
  subAgents: [trizAgent, fiveWaysAgent],
});

const solutionEvaluatorAgent = new LlmAgent({
  name: 'solution_evaluator',
  model,
  instruction: solutionEvaluatorInstruction,
  outputKey: 'ranked_solutions',
});

export const rootAgent = new SequentialAgent({
  name: 'root_agent',
  subAgents: [
    problemExtractorAgent,
    solutionGeneratorsAgent,
    solutionEvaluatorAgent,
  ],
});
```

- [ ] **Step 2: Check edited file diagnostics**

Run IDE diagnostics for `adg-agents/agent.ts`.

Expected: no new TypeScript diagnostics for imports, constructor config keys, or `rootAgent` export.

## Task 2: Verify Static Agent Module Loading

**Files:**
- Verify: `adg-agents/agent.ts`

- [ ] **Step 1: Run the agent module with Bun**

Run from `adg-agents`:

```bash
bun ./agent.ts
```

Expected: command exits with code `0`. The command should not print a TypeScript import error for `ParallelAgent`, `SequentialAgent`, `MCPToolset`, or `StreamableHTTPConnectionParams`.

- [ ] **Step 2: If Bun static loading fails because Bun is unavailable**

Run from `adg-agents`:

```bash
node --import ts-node/register ./agent.ts
```

Expected: command exits with code `0`, or reports only that `ts-node` cannot be loaded. If both Bun and `ts-node` are unavailable, use the Docker verification in Task 3 as the module-load check.

## Task 3: Verify Runtime Agent Behavior Through Existing API

**Files:**
- Verify: `docker-compose.yml`
- Verify: `apps/api/src/app/agent.service.ts`
- Verify: `adg-agents/agent.ts`

- [ ] **Step 1: Rebuild and start the composed services**

Run from `solution-system`:

```bash
docker compose up --build
```

Expected:
- `mcp-server` starts on port `8000`.
- `adk-agent` starts on port `8081`.
- `api` starts on port `3000`.
- `frontend` starts with its existing configuration.
- The agent container receives `MCP_SERVER_URL=http://mcp-server:8000/mcp`.

- [ ] **Step 2: Send a contradiction-style prompt through the Nest API**

With the stack running, run from any terminal:

```bash
curl -sS http://localhost:3000/api/agent/messages \
  -H 'Content-Type: application/json' \
  -d '{"message":"I want our web chat to feel instant, but preserving backend cost means I cannot call the LLM on every keystroke. Find the best solution options."}'
```

Expected:
- JSON response includes `sessionId`.
- JSON response `text` starts with `# Ranked Solutions` or contains a clear `Ranked Solutions` heading.
- The answer includes numbered candidates.
- Each candidate includes `Score`, `Source`, `Pros`, `Cons`, and `Why it ranks here`.
- At least one candidate source is `TRIZ` or `Both` when TRIZ MCP tool calls succeed.

- [ ] **Step 3: Stop the composed services after verification**

From the `solution-system` terminal running Docker Compose, press `Ctrl+C`.

Expected: services shut down cleanly.

## Task 4: Final Checks

**Files:**
- Verify: `adg-agents/agent.ts`
- Verify: `docs/superpowers/specs/2026-07-04-agent-solver-orchestration-design.md`

- [ ] **Step 1: Re-read the implementation against the spec**

Confirm `adg-agents/agent.ts` implements each required stage:
- problem extraction
- TRIZ solving with MCP tools
- five-ways solving
- parallel solver stage
- merged evaluator ranking

Expected: every stage in the spec maps to a concrete agent or workflow agent.

- [ ] **Step 2: Confirm no unrelated files were edited**

Run from `solution-system`:

```bash
git diff -- adg-agents/agent.ts docs/superpowers/plans/2026-07-04-agent-solver-orchestration.md docs/superpowers/specs/2026-07-04-agent-solver-orchestration-design.md
```

Expected: diff only includes the approved spec, this plan, and the intended `agent.ts` workflow change.

- [ ] **Step 3: Leave committing to the user**

Do not create a git commit unless the user explicitly asks for one.

Expected: implementation remains as working tree changes only.

## Self-Review

- Spec coverage: The plan covers all approved stages from the design: core problem extraction, TRIZ MCP solving, five-ways solving, merge/deduplication, evaluator scoring, and ranked final response.
- Completeness scan: The plan contains concrete file paths, complete replacement code for `agent.ts`, exact verification commands, and expected outcomes.
- Type consistency: The plan uses installed `@google/adk` exports and config keys verified in local package types: `LlmAgent`, `SequentialAgent`, `ParallelAgent`, `MCPToolset`, `StreamableHTTPConnectionParams`, `subAgents`, `tools`, and `outputKey`.
- Commit handling: No commit step is included because repository instructions require explicit user approval before committing.
