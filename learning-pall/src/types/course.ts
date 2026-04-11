export type BloomsLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export interface Resource {
  type: "article" | "video" | "whitepaper" | "statistic" | "internal";
  title: string;
  url: string;
  description: string;
}

export interface Module {
  title: string;
  bloomsLevel: BloomsLevel;
  estimatedMinutes: number;
  overview: string;
  keyConcepts: { term: string; definition: string }[];
  content: string;
  resources: Resource[];
  skills: string[];
}

export interface Course {
  id: string;
  topic: string;
  courseTitle: string;
  courseDescription: string;
  estimatedTotalMinutes: number;
  modules: Module[];
  createdAt: string;
}

export interface CourseProgress {
  courseId: string;
  completedModules: number[];
  moduleScores: Record<number, { difficulty: number; passed: boolean }>;
  currentModule: number;
  skills: string[];
  learnerName?: string;
}

export const BLOOMS_LEVELS: {
  level: BloomsLevel;
  label: string;
  description: string;
  color: string;
  moduleIndex: number;
}[] = [
  {
    level: "remember",
    label: "Remember",
    description: "Recall facts, terms, and foundational knowledge",
    color: "#B3C9CD",
    moduleIndex: 0,
  },
  {
    level: "understand",
    label: "Understand",
    description: "Explain ideas, interpret meaning, and summarize",
    color: "#8BA18E",
    moduleIndex: 1,
  },
  {
    level: "apply",
    label: "Apply",
    description: "Use knowledge in new situations and scenarios",
    color: "#CFAE70",
    moduleIndex: 2,
  },
  {
    level: "analyze",
    label: "Analyze",
    description: "Break down information and examine relationships",
    color: "#ECB748",
    moduleIndex: 3,
  },
  {
    level: "evaluate",
    label: "Evaluate",
    description: "Make judgments, critique, and assess value",
    color: "#946E24",
    moduleIndex: 4,
  },
  {
    level: "create",
    label: "Create",
    description: "Produce original work, design, and synthesize",
    color: "#1C1C1C",
    moduleIndex: 5,
  },
];
