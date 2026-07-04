// ==========================================
// ENUMS & TYPES (Base types for strictness)
// ==========================================

export enum GenerationMethod {
  TRIZ = 'TRIZ', // Mandatory method 1
  BIOMIMICRY = 'BIOMIMICRY', // Alternative method 2
  CROSS_INDUSTRY_ANALOGY = 'CROSS_INDUSTRY_ANALOGY', // Alternative method 3
}

export enum SolutionCategory {
  SHORT_TERM_EASY = 'SHORT_TERM_EASY', // Tab A: Low CapEx, software updates, quick patches
  LONG_TERM_HIGH_IMPACT = 'LONG_TERM_HIGH_IMPACT', // Tab B: High CapEx, structural changes, new materials
}

// Citations for RAG (Explainability feature)
export interface RagCitationDto {
  sourceId: string;
  title: string; // Title of the patent, research paper, or regulation
  urlOrDoi: string;
  relevantExcerpt: string;
}

// ==========================================
// STEP 0: INPUT (User Request)
// ==========================================

export class SubmitProblemRequestDto {
  // The "Joker" field. Replaces hardcoded enums like VesselType.
  // Example for SDG 14: { environment: 'Arctic', vesselMass: 300000 }
  // Example for SDG 12: { materialType: 'PCB', annualVolumeTons: 50000 }
  domainParameters!: Record<string, any>; 
  
  // Specific scenario description (e.g., "Double hull breach" or "E-waste recycling plant bottleneck")
  problemContext!: string; 

  // Geopolitical, Economic, or Environmental constraints (e.g., "Zero dry-docking")
  hardConstraints!: string[]; 
}

// ==========================================
// STEP 1 & 2: PROBLEM PARSING & TRIZ (Release 1 & 2)
// ==========================================

export class Step1ProblemDefinitionDto {
  stepId: 1 = 1;
  status!: 'COMPLETED' | 'FAILED' | 'NEEDS_CLARIFICATION';
  parsedGoal!: string;
  clarificationQuestions?: string[]; // Triggers Release 2 Interactive Loop if status is NEEDS_CLARIFICATION
}

export class Step2ContradictionDto {
  stepId: 2 = 2;
  status!: 'COMPLETED' | 'FAILED';
  identifiedConflicts!: string[];
  keyContradiction!: {
    improvingParameter: string; // e.g., "Strength of hull"
    worseningParameter: string; // e.g., "Weight of ship"
  };
  recommendedMethod!: GenerationMethod;
}

// ==========================================
// STEP 3: CANDIDATE GENERATION (Release 1 Parallelization)
// ==========================================

export class CandidateSolutionDto {
  candidateId!: string;
  category!: SolutionCategory; // Tab A or Tab B
  title!: string;
  shortDescription!: string;
  technicalImplementation!: string; // The core engineering logic
  appliedMethodology!: GenerationMethod; // Usually TRIZ
  ragCitations!: RagCitationDto[]; // CRITICAL FOR EXPLAINABILITY
}

export class Step3CandidatesDto {
  stepId: 3 = 3;
  status!: 'COMPLETED' | 'FAILED';
  candidates!: CandidateSolutionDto[]; // Expecting 2-4 candidates here
}

// ==========================================
// STEP 4: EVALUATION & REALITY CHECK (Release 2)
// ==========================================

export interface RealityCheckAlertDto {
  severity: 'WARNING' | 'CRITICAL_FAILURE';
  violatedConstraint: string;
  reason: string; // e.g., "Fails Arctic temperature constraint due to polymer freezing point"
  ragCitation?: RagCitationDto; // Proof of why it fails
}

export class CandidateEvaluationDto {
  candidateId!: string;
  score!: number; // 0-100
  pros!: string[];
  cons!: string[];
  realityCheckAlerts!: RealityCheckAlertDto[]; // Automated physics/constraints verification
  
  // Interactive Validation (Human-in-the-Loop)
  userValidation?: 'TECHNICALLY_VIABLE' | 'FAILS_CONSTRAINTS'; 
}

export class Step4EvaluationDto {
  stepId: 4 = 4;
  status!: 'COMPLETED' | 'FAILED';
  evaluations!: CandidateEvaluationDto[]; // Scoring matrix for all generated candidates
}

// ==========================================
// STEP 5: FINAL CHOICE & EXPLAINABILITY
// ==========================================

export class Step5FinalRecommendationDto {
  stepId: 5 = 5;
  status!: 'COMPLETED' | 'FAILED';
  winningCandidateId!: string;
  winnerDetails!: CandidateSolutionDto;
  explainabilityReport!: {
    whyItWon: string; // Detailed explanation for the end-user
    howItSolvesContradiction: string;
    complianceWithConstraints: string;
  };
  rejectedAlternativesSummary!: {
    candidateId: string;
    rejectionReason: string; // e.g., "Rejected due to Reality Check Alert (temperature constraint)"
  }[];
  nextSteps!: string[];
}

// ==========================================
// MASTER RESPONSE DTO (API Output to Frontend)
// ==========================================

export class ReasoningTrailResponseDto {
  pipelineId!: string; // Trace ID for logging/auditing
  timestamp!: string;
  isSuccess!: boolean;
  
  // The full inspectable chain (Hackathon requirement: "not a single prompt")
  trail!: {
    step1_problem: Step1ProblemDefinitionDto;
    step2_contradiction: Step2ContradictionDto;
    step3_candidates: Step3CandidatesDto;
    step4_evaluation: Step4EvaluationDto;
    step5_choice: Step5FinalRecommendationDto;
  };
}
