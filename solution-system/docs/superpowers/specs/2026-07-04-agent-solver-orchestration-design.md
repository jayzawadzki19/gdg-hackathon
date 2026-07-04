# Agent Solver Orchestration - Design

**Date:** 2026-07-04
**Status:** Approved
**Scope:** Expand the ADK agent from a single TRIZ specialist into a small solving pipeline that extracts the core problem, generates solutions through TRIZ and a general five-ways method, then evaluates and ranks the merged candidates.

## Context

- `adg-agents/agent.ts` currently exports one `rootAgent` configured as a TRIZ specialist.
- The TRIZ agent uses an `MCPToolset` connected through `MCP_SERVER_URL`, falling back to `http://localhost:8000/mcp`.
- The API and frontend already send user messages to the ADK app and display the final model text, so the orchestration can stay inside the ADK agent layer.
- ADK TypeScript supports agent composition through `subAgents` and workflow agents such as `ParallelAgent`, which fits the requested pipeline.

## Architecture

The root ADK agent will become a workflow-style coordinator with these stages:

1. `problemExtractorAgent` receives the original user problem and rewrites it into a concise core problem statement.
2. `trizAgent` receives the extracted core problem and generates TRIZ-backed candidate solutions using the existing MCP toolset.
3. `fiveWaysAgent` receives the same extracted core problem and generates five alternative candidate solutions through different problem-solving angles.
4. A parallel solving stage runs `trizAgent` and `fiveWaysAgent` side by side.
5. `solutionEvaluatorAgent` merges both result sets, removes duplicates, scores the candidates, and returns a ranked list.

The TRIZ MCP toolset will remain attached only to `trizAgent`. The extractor, five-ways solver, and evaluator will not receive MCP tools because they do not need direct TRIZ data access.

## Agent Responsibilities

`problemExtractorAgent` will:

- Identify the user's actual goal, constraint, and tension.
- Remove incidental phrasing or implementation noise.
- Preserve domain-specific details that affect solution quality.
- Output only the core problem and key constraints.

`trizAgent` will:

- Use the existing TRIZ MCP tools to identify relevant engineering parameters.
- Query the contradiction matrix when the problem contains a contradiction.
- Translate TRIZ principles into concrete candidate solutions.
- Output candidate solutions in a form the evaluator can compare.

`fiveWaysAgent` will:

- Produce five distinct solution candidates.
- Use varied reasoning angles, such as simplification, automation, decomposition, inversion, and resource reuse.
- Keep candidates practical and specific to the extracted problem.

`solutionEvaluatorAgent` will:

- Merge TRIZ and five-ways candidates.
- Deduplicate overlapping ideas.
- Score each candidate from 1 to 10 using feasibility, impact, cost, risk, and clarity.
- Return a ranked final answer with pros, cons, and the reason each score was assigned.

## Final Response Shape

The user-facing response will be a ranked solution list:

```markdown
# Ranked Solutions

## 1. <solution title>
Score: <n>/10
Pros: <short practical benefits>
Cons: <short risks or trade-offs>
Why it ranks here: <evaluation rationale>

## 2. <solution title>
...
```

The final answer should favor clarity over exposing all intermediate agent outputs. It may briefly mention whether a solution came from TRIZ, the five-ways solver, or both when that context helps explain the ranking.

## Error Handling

If the TRIZ MCP tool calls fail, the TRIZ agent must not invent MCP-backed TRIZ results. It should clearly report the failure in its output so the evaluator can either down-rank TRIZ candidates or explain that only non-TRIZ candidates were evaluated.

If either solver produces no useful candidates, the evaluator should still rank the remaining candidates and briefly mention the missing source.

## Testing

Verification will focus on the ADK agent module and runtime behavior:

- Static-load or type-check `adg-agents/agent.ts` if the available scripts support it.
- Run the composed services.
- Send a problem-solving prompt through the existing Nest API.
- Confirm the response is a ranked list with scores, pros, cons, and evaluation rationale.
- Confirm TRIZ-derived suggestions still use the MCP-backed TRIZ tools.

## Out of Scope

- Adding new MCP tools.
- Changing the Nest API contract.
- Changing the frontend chat UI.
- Persisting intermediate agent outputs.
- Exposing internal agent traces to the user.
