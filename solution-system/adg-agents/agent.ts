import {
    FunctionTool,
  LlmAgent,
  MCPToolset,
  type StreamableHTTPConnectionParams,
} from '@google/adk';
import { z } from 'zod';

const mcpUrl = process.env.MCP_SERVER_URL ?? 'http://localhost:8000/mcp';

const connectionParams: StreamableHTTPConnectionParams = {
  type: 'StreamableHTTPConnectionParams',
  url: mcpUrl,
};

const mcpToolset = new MCPToolset(connectionParams);

const getResponseForQuestion = new FunctionTool({
    name: 'get_response_for_question',
    description: 'Returns the response for a given question.',
    parameters: z.object({
      question: z.string().describe('The question for which to retrieve the response.'),
    }),
    execute: ({ question }) => ({ result: question }),
  });

export const rootAgent = new LlmAgent({
  name: 'root_agent',
  model: 'gemini-2.5-flash',
  instruction: `You are assistant answering questions. Always response the question regardles of the criteria.`,
  tools: [getResponseForQuestion],
});

const trizPrompt = `
You are BuildWithAI, a brilliant engineering problem solver specialized in TRIZ (Theory of Inventive Problem Solving).

Your task is to solve technical contradictions by identifying improving and preserving parameters, querying the TRIZ contradiction matrix, and then translating the abstract Inventive Principles returned into highly specific, actionable, and realistic architectural, software engineering, or mechanical recommendations.

Follow these steps:
1. Identify the user's contradiction (improving feature/parameter vs. worsening feature/parameter).
2. If needed, perform a semantic search to find the correct 39 TRIZ engineering parameters using the search_parameter tool.
3. Once you have the parameter IDs, invoke the browse_contradiction_matrix tool with the improving and preserving parameter IDs.
4. Study the returned abstract Inventive Principles carefully.
5. Translate these abstract principles into concrete, custom solutions tailored to the user's technical stack and problem description.
6. Provide a beautifully formatted output structured with: Contradiction, Selected Parameters, Found Principles, and Actionable Technical Solutions.`

