import { BloomsLevel } from "@/types/course";

export const BLOOMS_CONFIG: Record<
  BloomsLevel,
  {
    label: string;
    verb: string;
    description: string;
    color: string;
    icon: string;
  }
> = {
  remember: {
    label: "Remember",
    verb: "Recall",
    description: "Retrieve relevant knowledge from long-term memory",
    color: "#B3C9CD",
    icon: "brain",
  },
  understand: {
    label: "Understand",
    verb: "Explain",
    description:
      "Construct meaning from instructional messages and experiences",
    color: "#8BA18E",
    icon: "lightbulb",
  },
  apply: {
    label: "Apply",
    verb: "Execute",
    description: "Carry out or use a procedure in a given situation",
    color: "#CFAE70",
    icon: "wrench",
  },
  analyze: {
    label: "Analyze",
    verb: "Differentiate",
    description:
      "Break material into constituent parts and determine relationships",
    color: "#ECB748",
    icon: "search",
  },
  evaluate: {
    label: "Evaluate",
    verb: "Judge",
    description: "Make judgments based on criteria and standards",
    color: "#946E24",
    icon: "scale",
  },
  create: {
    label: "Create",
    verb: "Produce",
    description: "Put elements together to form a coherent whole or new pattern",
    color: "#1C1C1C",
    icon: "sparkles",
  },
};

export function getBloomsLevel(index: number): BloomsLevel {
  const levels: BloomsLevel[] = [
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
  ];
  return levels[index] || "remember";
}
