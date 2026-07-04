# Agent Reasoning & Execution Flow (by Releases)

This document visualizes and describes the internal reasoning steps, execution pipeline, and tool routing mechanisms of the Maritime R&D Assistant, mapped across the three product release stages.

---

## 🌊 Execution Pipeline Diagram

The flowchart below illustrates how a user's problem is parsed, routed to candidate generators in parallel, evaluated, and explained. The steps are color-coded by release:
*   **Light Blue (Solid)**: Release 1 (MVP Core)
*   **Light Red (Dashed)**: Release 2 (Interactive Loop)
*   **Light Green (Dashed)**: Release 3 (Dynamic Routing & Enterprise)

```mermaid
flowchart TD
    A([Start]) --> B[User submits problem]

    subgraph r2 ["Release 2: Interactive Loop"]
        C[Define problem]
        C1[Define user goal]
        C2[Define what to focus on]
        C3[Define what to ignore]
        D{Is problem clear enough?}
        E[Ask clarification questions]
        
        C --> C1
        C1 --> C2
        C2 --> C3
        C3 --> D
    end

    subgraph r1 ["Release 1: MVP Core - TRIZ & Execution"]
        F[Identify contradictions]
        F1[Find conflicts and trade-offs]
        F2[Define key contradiction]
        
        F --> F1
        F1 --> F2
    end

    subgraph r3 ["Release 3: Dynamic Routing"]
        G[Define research tools]
        G1[Select tools based on problem type]
        G2[Assign tools to candidate agents]
        G3[Define tool purpose and expected output]
        
        G --> G1
        G1 --> G2
        G2 --> G3
    end

    subgraph r1_parallel ["Release 1: MVP Core - Parallel Generation"]
        H[Run all solution candidates in parallel]
        H1[Candidate A researches solution path]
        H2[Candidate B researches solution path]
        H3[Candidate C researches solution path]
        H4[Candidate N researches solution path]
        
        H --> H1
        H --> H2
        H -.-> H3
        H -.-> H4
    end

    subgraph r2_eval ["Release 2: Deep Evaluation"]
        I[Evaluate candidates]
        I1[Group similar solutions]
        I2[List pros and cons]
        I3[Score each candidate]
        
        I -.-> I1
        I1 -.-> I2
        I2 -.-> I3
    end

    subgraph r1_explain ["Release 1: MVP Core - Explainability"]
        I4[Select best candidates]
        J[Choose final solution]
        J1[Explain why it is best]
        
        I4 --> J
        J --> J1
    end

    subgraph r3_export ["Release 3: Enterprise Export"]
        J2[Explain rejected alternatives]
        J3[Define next steps]
        
        J2 -.-> J3
    end

    K([End])

    %% Connections between subgraphs
    B -.-> C
    B --> F
    D -.->|No| E
    E -.-> B
    D -.->|Yes| F
    F2 -.-> G
    F2 -->|Hardcoded RAG Tool| H
    G3 -.-> H
    
    H1 --> I
    H2 --> I
    H3 -.-> I
    H4 -.-> I
    
    I --> I4
    I3 -.-> I4
    
    J1 -.-> J2
    J1 --> K
    J3 -.-> K

    %% Styling configurations for visual coding
    classDef mvp fill:#e1f5fe,stroke:#3182ce,stroke-width:2px,color:#2b6cb0
    classDef rel2 fill:#fff5f5,stroke:#dd6b20,stroke-width:2px,stroke-dasharray: 5 5,color:#c05621
    classDef rel3 fill:#f0fff4,stroke:#38a169,stroke-width:2px,stroke-dasharray: 5 5,color:#2f855a
    
    class B,F,F1,F2,H,H1,H2,I4,J,J1 mvp
    class C,C1,C2,C3,D,E,I,I1,I2,I3 rel2
    class G,G1,G2,G3,J2,J3 rel3
```

---

## 🛠️ Step-by-Step Pipeline Breakdown

### 📦 Release 1: MVP Core (Blue Items)
In the initial release, the system operates as a direct execution pipeline focusing on the primary contradiction:
1.  **Contradiction Identification**: The user submits a problem (e.g. *hull breach*), and the agent immediately analyzes it to isolate technical conflicts (e.g. *reducing flow rate* vs. *increasing weight*) and define the key TRIZ contradiction.
2.  **Hardcoded RAG & Parallel Generation**: The agent triggers parallel candidate generation branches (Candidate A, B, etc.). Each candidate uses a hardcoded RAG tool to search parameters and principles.
3.  **Explainability Selection**: The best concepts are selected, the final solution is recommended, and the system outputs an explanation detailing *why* it was chosen alongside its RAG citations and TRIZ principles.

### 🚀 Release 2: Interactive Loop & Deep Evaluation (Red Items)
Release 2 introduces user interaction and a refinement loop before concept generation:
1.  **Interactive Definition**: Rather than going straight to execution, the agent guides the user to define their goals, focus areas, and what constraints to ignore. If the problem is unclear, it triggers clarification questions.
2.  **Deep Evaluation**: Generated candidates undergo deep evaluation: grouping similar solutions, compiling pros and cons, and scoring candidates before final selection.

### 🌐 Release 3: Dynamic Routing & Enterprise Export (Green Items)
The final tier adds dynamic routing capability and enterprise-grade reporting:
1.  **Dynamic Routing**: The agent analyzes the problem type and dynamically selects from a registry of available tools (e.g. patent databases, chemistry specifications), assigning specific tools to specific candidate agents based on context.
2.  **Enterprise Export**: Along with explaining the chosen concept, the system outputs detailed reports explaining why alternative solutions were rejected and defines concrete next steps for implementation.
