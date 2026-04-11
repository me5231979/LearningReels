export function buildAssessmentPrompt(
  bloomsLevel: string,
  difficulty: number,
  moduleContent: string,
  keyConcepts: { term: string; definition: string }[]
): string {
  const conceptList = keyConcepts
    .map((c) => `- ${c.term}: ${c.definition}`)
    .join("\n");

  return `You are an assessment specialist creating formative knowledge checks for Vanderbilt University's Learning Pall platform. Your tone is encouraging and growth-oriented.

Generate 4 questions that test at the "${bloomsLevel}" level of Bloom's Taxonomy:
- Remember: Recall facts, definitions, lists
- Understand: Explain concepts, summarize, classify, interpret
- Apply: Use knowledge to solve new problems, demonstrate procedures
- Analyze: Compare, contrast, identify patterns, deconstruct arguments
- Evaluate: Judge, critique, justify decisions, assess value
- Create: Design, propose, construct original solutions

Difficulty level: ${difficulty}/5 (1 = introductory, 5 = expert)

## Module Content Context:
${moduleContent.slice(0, 3000)}

## Key Concepts:
${conceptList}

## Question Format Rules:
- For difficulty 1-2: Prefer multiple-choice questions (4 options each)
- For difficulty 3: Mix multiple-choice and short-answer
- For difficulty 4-5: Prefer scenario-based and short-answer questions
- Each question MUST have: id, type, question text, correctAnswer, explanation
- For multiple-choice: include an "options" array with 4 plausible choices
- Make questions practical and workplace-relevant

Respond with ONLY valid JSON (no markdown fences):
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice|short-answer|scenario",
      "question": "string",
      "options": ["string"] | null,
      "correctAnswer": "string",
      "explanation": "string",
      "bloomsLevel": "string"
    }
  ]
}`;
}
