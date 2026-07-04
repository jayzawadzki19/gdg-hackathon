# BuildWithAI: SolutionSystem Monorepo

This directory contains the Nx-based monorepo for the BuildWithAI TRIZ MCP agent platform. It manages the Angular frontend application, NestJS backend API gateway, and provides references to the ADK agent and python MCP server.

---

## 📂 Monorepo Structure

* **`apps/frontend`**: Angular client app containing the TRIZ Chat Interface. Uses CSS variables mapped to design-system semantic tokens.
* **`apps/api`**: NestJS gateway backend. Receives chat messages, manages sessions, proxies upstream calls to the ADK agent via SSE, and maps response structures.
* **`adg-agents`**: Google Agent Development Kit (ADK) service config using Gemini LLM and MCP toolsets.
* **`mcp-server`**: Python FastMCP server executing TRIZ contradiction matrix searches.
* **`docs`**: Technical specifications and developer plans.

---

## 🛠️ Nx Development Commands

This monorepo uses [Nx](https://nx.dev) to manage tasks, builds, and dependencies.

### Running Development Servers

Run both the NestJS API and Angular frontend concurrently:
```sh
npm run start
```
Or start them individually:

* **Start Backend API only**:
  ```sh
  npm run start:api
  # or: npx nx serve api
  ```
* **Start Frontend Client only**:
  ```sh
  npm run start:frontend
  # or: npx nx serve frontend
  ```

### Testing & Linting

Run tests for the whole workspace:
```sh
npm run test
# or individual projects:
npx nx test api
npx nx test frontend
```

Lint code in the monorepo:
```sh
npm run lint
# or individual projects:
npx nx lint api
npx nx lint frontend
```

### Production Build

Create production bundles for all applications:
```sh
npm run build
# or individual projects:
npx nx build api
npx nx nx build frontend
```

---

## 🐳 Running with Docker

From this folder, you can boot the entire multi-container setup (API gateway, ADK agent, and MCP server):

```bash
docker compose up --build
```

Ensure you have populated the `.env` file in this directory with a valid `GOOGLE_GENAI_API_KEY` before launching Docker.
