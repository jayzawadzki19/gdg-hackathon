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
