export interface Question {
  id: string;
  type: "multiple-choice" | "short-answer" | "scenario";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  bloomsLevel: string;
}

export interface Evaluation {
  questionId: string;
  confidence: "strong" | "developing" | "needs-review";
  feedback: string;
  isCorrect: boolean;
}

export interface AssessmentResult {
  evaluations: Evaluation[];
  canProgress: boolean;
  newDifficulty: number;
  overallFeedback: string;
}

export interface AssessmentState {
  questions: Question[];
  answers: Record<string, string>;
  result: AssessmentResult | null;
  difficulty: number;
  isLoading: boolean;
}
