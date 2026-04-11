"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { Question, AssessmentResult } from "@/types/assessment";
import { Module } from "@/types/course";
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RotateCcw,
  MessageSquare,
} from "lucide-react";

interface KnowledgeCheckProps {
  module: Module;
  moduleIndex: number;
  difficulty: number;
  onComplete: (passed: boolean, newDifficulty: number) => void;
}

export default function KnowledgeCheck({
  module,
  moduleIndex,
  difficulty,
  onComplete,
}: KnowledgeCheckProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);

  async function generateQuestions() {
    setLoading(true);
    setStarted(true);
    try {
      const res = await fetch("/api/assessment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bloomsLevel: module.bloomsLevel,
          difficulty,
          moduleContent: module.content,
          keyConcepts: module.keyConcepts,
        }),
      });
      const data = await res.json();
      setQuestions(data.questions);
      setAnswers({});
      setResult(null);
      setSubmitted(false);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswers() {
    setLoading(true);
    try {
      const res = await fetch("/api/assessment/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions,
          answers,
          bloomsLevel: module.bloomsLevel,
          difficulty,
        }),
      });
      const data: AssessmentResult = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }

  const allAnswered =
    questions.length > 0 && questions.every((q) => answers[q.id]?.trim());

  if (!started) {
    return (
      <div className="mt-8 bg-white/5 border border-white/10 rounded-sm p-6">
        <div className="text-center py-4">
          <MessageSquare className="w-8 h-8 text-vand-gold mx-auto mb-3" />
          <h3 className="font-serif text-xl font-bold text-white mb-2">
            Knowledge Check — Module {moduleIndex + 1}
          </h3>
          <p className="text-sm text-vand-sand/60 mb-4 max-w-md mx-auto">
            Ready to demonstrate your understanding? This adaptive check adjusts
            to your level and provides personalized feedback.
          </p>
          <Button variant="primary" onClick={generateQuestions}>
            Begin Knowledge Check
          </Button>
        </div>
      </div>
    );
  }

  if (loading && questions.length === 0) {
    return (
      <div className="mt-8 bg-white/5 border border-white/10 rounded-sm p-6">
        <div className="flex flex-col items-center py-8">
          <Spinner />
          <p className="text-sm text-vand-sand/60 mt-3">
            Generating your personalized questions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-white/5 border border-white/10 rounded-sm p-6">
      <h3 className="font-serif text-xl font-bold text-white mb-1">
        Knowledge Check
      </h3>
      <p className="text-xs text-vand-sand/50 mb-6">
        Difficulty: {difficulty}/5 &middot;{" "}
        {module.bloomsLevel.charAt(0).toUpperCase() +
          module.bloomsLevel.slice(1)}{" "}
        level
      </p>

      <div className="space-y-6">
        {questions.map((q, i) => {
          const evaluation = result?.evaluations.find(
            (e) => e.questionId === q.id
          );

          return (
            <div
              key={q.id}
              className={`p-4 rounded-sm border ${
                evaluation
                  ? evaluation.isCorrect
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                  : "border-white/10"
              }`}
            >
              <p className="font-medium text-white mb-3">
                {i + 1}. {q.question}
              </p>

              {q.type === "multiple-choice" && q.options ? (
                <div className="space-y-2">
                  {q.options.map((option, j) => (
                    <label
                      key={j}
                      className={`flex items-center gap-3 p-2.5 rounded-sm border cursor-pointer transition-colors ${
                        answers[q.id] === option
                          ? "border-vand-gold/50 bg-vand-gold/10"
                          : "border-white/10 hover:border-white/20"
                      } ${submitted ? "pointer-events-none" : ""}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={option}
                        checked={answers[q.id] === option}
                        onChange={() =>
                          setAnswers((prev) => ({ ...prev, [q.id]: option }))
                        }
                        disabled={submitted}
                        className="accent-[#CFAE70]"
                      />
                      <span className="text-sm text-vand-sand">{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className="w-full p-3 rounded-sm border border-white/10 bg-white/5 text-sm text-white resize-none focus:border-vand-gold focus:ring-1 focus:ring-vand-gold/50 outline-none placeholder:text-vand-sand/40"
                  rows={3}
                  placeholder="Type your answer..."
                  value={answers[q.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  disabled={submitted}
                />
              )}

              {evaluation && (
                <div className="mt-3 flex items-start gap-2">
                  {evaluation.isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span
                      className={`text-xs font-semibold uppercase ${
                        evaluation.confidence === "strong"
                          ? "text-green-400"
                          : evaluation.confidence === "developing"
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {evaluation.confidence}
                    </span>
                    <p className="text-sm text-vand-sand/70 mt-0.5">
                      {evaluation.feedback}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Result & Actions */}
      {result && (
        <div className="mt-6 p-4 rounded-sm bg-white/5 border border-white/10">
          <p className="text-sm text-white font-medium mb-2">
            {result.overallFeedback}
          </p>
          <div className="flex gap-3 mt-3">
            {result.canProgress ? (
              <Button
                variant="primary"
                onClick={() => onComplete(true, result.newDifficulty)}
              >
                <span className="flex items-center gap-2">
                  Continue to Next Module
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            ) : (
              <Button variant="secondary" onClick={generateQuestions}>
                <span className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </span>
              </Button>
            )}
          </div>
        </div>
      )}

      {!submitted && questions.length > 0 && (
        <div className="mt-6">
          <Button
            variant="primary"
            onClick={submitAnswers}
            disabled={!allAnswered || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Evaluating...
              </span>
            ) : (
              "Submit Answers"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
