import { Question } from "@/types/assessment";

export function buildEvaluationPrompt(
  questions: Question[],
  answers: Record<string, string>,
  bloomsLevel: string,
  difficulty: number
): string {
  const qaPairs = questions
    .map(
      (q) =>
        `Question (${q.type}): ${q.question}\nCorrect Answer: ${q.correctAnswer}\nLearner's Answer: ${answers[q.id] || "(no answer)"}`
    )
    .join("\n\n");

  return `You are a supportive learning coach for Vanderbilt University's Learning Pall platform. Your tone is encouraging, confident, and growth-oriented — aligned with Vanderbilt's brand voice and the motto "Dare to grow."

Evaluate the following learner responses at the "${bloomsLevel}" level of Bloom's Taxonomy (difficulty: ${difficulty}/5).

## Questions and Answers:
${qaPairs}

## Evaluation Instructions:

For each answer:
1. Determine if it demonstrates understanding at the ${bloomsLevel} level
2. Provide specific, constructive feedback (2-3 sentences). Be encouraging but honest.
3. If incorrect, guide the learner toward the right thinking WITHOUT giving the answer directly
4. Rate confidence: "strong" (clear mastery), "developing" (on the right track), or "needs-review" (significant gaps)

Overall progression rule:
- Learner can progress if at least 3 of 4 answers are rated "strong" or "developing"
- If they cannot progress, provide encouragement and specific study suggestions

Difficulty adjustment:
- All strong → increase difficulty by 1 (max 5)
- Mixed results → keep same difficulty
- Mostly needs-review → decrease difficulty by 1 (min 1)

Respond with ONLY valid JSON (no markdown fences):
{
  "evaluations": [
    {
      "questionId": "string",
      "confidence": "strong|developing|needs-review",
      "feedback": "string",
      "isCorrect": boolean
    }
  ],
  "canProgress": boolean,
  "newDifficulty": number,
  "overallFeedback": "string (2-3 sentences, encouraging, specific)"
}`;
}
