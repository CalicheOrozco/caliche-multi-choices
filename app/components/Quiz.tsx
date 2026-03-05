"use client";

import { useMemo, useState } from "react";

export type QuizQuestion = {
  id: number | string;
  question: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation?: string;
};

type QuizPhase = "setup" | "quiz" | "results";

type AnswerState = {
  selected?: string;
  checked?: boolean;
  isCorrect?: boolean;
};

type QuizProps = {
  questions: QuizQuestion[];
  seed: number;
};

function normalizeId(id: QuizQuestion["id"]) {
  return String(id);
}

function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleQuestions(input: QuizQuestion[], seed: number) {
  const arr = [...input];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function Quiz({ questions, seed }: QuizProps) {
  const [phase, setPhase] = useState<QuizPhase>("setup");
  const [desiredCount, setDesiredCount] = useState<number>(10);
  const [activeQuestionIds, setActiveQuestionIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersById, setAnswersById] = useState<Record<string, AnswerState>>(
    {},
  );

  const orderedQuestions = useMemo(() => {
    return shuffleQuestions(questions, seed);
  }, [questions, seed]);

  const questionsById = useMemo(() => {
    const map = new Map<string, QuizQuestion>();
    for (const q of questions) {
      map.set(normalizeId(q.id), q);
    }
    return map;
  }, [questions]);

  const [remainingQuestionIds, setRemainingQuestionIds] = useState<string[]>(
    () => orderedQuestions.map((q) => normalizeId(q.id)),
  );

  const activeQuestions = useMemo(() => {
    if (phase === "setup") return [];
    return activeQuestionIds
      .map((id) => questionsById.get(id))
      .filter((q): q is QuizQuestion => !!q);
  }, [activeQuestionIds, phase, questionsById]);

  const results = useMemo(() => {
    const total = activeQuestions.length;
    let correct = 0;
    let incorrect = 0;

    for (const q of activeQuestions) {
      const a = answersById[normalizeId(q.id)];
      if (!a?.checked) continue;
      if (a.isCorrect) correct += 1;
      else incorrect += 1;
    }

    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, incorrect, scorePercent };
  }, [activeQuestions, answersById]);

  function selectOption(questionId: string, optionKey: string) {
    setAnswersById((prev) => ({
      ...prev,
      [questionId]: {
        selected: optionKey,
        checked: false,
        isCorrect: undefined,
      },
    }));
  }

  function checkAnswer(questionId: string) {
    const question = questionsById.get(questionId);
    if (!question) return;

    setAnswersById((prev) => {
      const selected = prev[questionId]?.selected;
      if (!selected) return prev;

      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          checked: true,
          isCorrect: selected === question.correct_answer,
        },
      };
    });
  }

  function goNext() {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      return next >= activeQuestions.length ? prev : next;
    });
  }

  function startQuiz() {
    const available = remainingQuestionIds.length;
    if (available <= 0) return;

    const limit = Math.max(1, Math.min(desiredCount, available));

    const picked = remainingQuestionIds.slice(0, limit);
    setActiveQuestionIds(picked);
    setRemainingQuestionIds((prev) => prev.slice(limit));
    setAnswersById({});
    setCurrentIndex(0);
    setPhase("quiz");
  }

  if (phase === "setup") {
    const remaining = remainingQuestionIds.length;
    const max = remaining;
    const clamped = max <= 0 ? 0 : Math.max(1, Math.min(desiredCount, max));
    const inputValue = max <= 0 ? 0 : desiredCount;

    return (
      <section className="w-full rounded-2xl border border-black/8 bg-background p-6 text-foreground dark:border-white/[.145]">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold leading-7">Quiz setup</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Choose how many questions you want to answer.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end pb-4">
          <label className="flex w-full flex-col gap-1 sm:max-w-xs">
            <span className="text-sm font-medium">Number of questions</span>
            <input
              type="number"
              inputMode="numeric"
              min={max <= 0 ? 0 : 1}
              max={max}
              value={inputValue}
              disabled={max <= 0}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDesiredCount(Number.isFinite(next) ? next : 1);
              }}
              className="h-11 rounded-xl border border-black/8 bg-black/3 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 dark:border-white/[.145] dark:bg-white/6"
            />
            <span className="text-xs text-zinc-600 dark:text-zinc-400">
              {max <= 0 ? "No questions remaining." : `Range: 1–${max}`}
            </span>
          </label>
        </div>
        <button
          type="button"
          disabled={max <= 0}
          onClick={() => {
            if (clamped !== desiredCount && clamped > 0) setDesiredCount(clamped);
            startQuiz();
          }}
          className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start
        </button>
      </section>
    );
  }

  if (phase === "results") {
    return (
      <section className="w-full rounded-2xl border border-black/8 bg-background p-5 text-foreground dark:border-white/[.145]">
        <h2 className="text-base font-semibold leading-7">Results</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-black/8 p-4 dark:border-white/[.145]">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Total</p>
            <p className="mt-1 text-2xl font-semibold">{results.total}</p>
          </div>
          <div className="rounded-xl border border-black/8 p-4 dark:border-white/[.145]">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Score</p>
            <p className="mt-1 text-2xl font-semibold">{results.scorePercent}%</p>
          </div>
          <div className="rounded-xl border border-green-600 bg-green-50 p-4 text-green-950 dark:border-green-400 dark:bg-green-950/40 dark:text-green-50">
            <p className="text-xs text-green-800/80 dark:text-green-100/80">
              Correct
            </p>
            <p className="mt-1 text-2xl font-semibold">{results.correct}</p>
          </div>
          <div className="rounded-xl border border-red-600 bg-red-50 p-4 text-red-950 dark:border-red-400 dark:bg-red-950/40 dark:text-red-50">
            <p className="text-xs text-red-800/80 dark:text-red-100/80">Incorrect</p>
            <p className="mt-1 text-2xl font-semibold">{results.incorrect}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setPhase("setup");
              setActiveQuestionIds([]);
              setAnswersById({});
              setCurrentIndex(0);
              const nextMax = remainingQuestionIds.length;
              if (nextMax > 0) {
                setDesiredCount((prev) => Math.max(1, Math.min(prev, nextMax)));
              }
            }}
            className="inline-flex h-10 items-center justify-center rounded-full border border-black/8 px-5 text-sm font-medium transition-colors hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-white/6"
          >
            Back to start
          </button>
        </div>
      </section>
    );
  }

  const safeIndex = Math.min(
    currentIndex,
    Math.max(activeQuestions.length - 1, 0),
  );
  const currentQuestion = activeQuestions[safeIndex];
  if (!currentQuestion) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No questions to display.
      </p>
    );
  }

  const currentQuestionId = normalizeId(currentQuestion.id);
  const currentAnswer = answersById[currentQuestionId];
  const optionEntries = Object.entries(currentQuestion.options ?? {}).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  const isLast = safeIndex === activeQuestions.length - 1;

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Question {safeIndex + 1} of {activeQuestions.length}
      </p>

      <section className="w-full rounded-2xl border border-black/8 bg-background p-5 text-foreground dark:border-white/[.145]">
        <h2 className="text-base font-semibold leading-7">
          {currentQuestion.id}. {currentQuestion.question}
        </h2>

        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="sr-only">Options</legend>
          {optionEntries.map(([key, label]) => {
            const inputId = `q-${currentQuestionId}-${key}`;
            const checked = currentAnswer?.selected === key;

            const isSelected = currentAnswer?.selected === key;
            const showResultStyling = !!currentAnswer?.checked && isSelected;
            const isSelectedCorrect =
              showResultStyling && currentAnswer?.isCorrect === true;
            const isSelectedIncorrect =
              showResultStyling && currentAnswer?.isCorrect === false;
            const isCorrectWhenUserIncorrect =
              !!currentAnswer?.checked &&
              currentAnswer?.isCorrect === false &&
              key === currentQuestion.correct_answer;

            return (
              <label
                key={key}
                htmlFor={inputId}
                className={
                  "flex w-full items-start gap-3 rounded-xl px-4 py-3 transition-colors " +
                  (currentAnswer?.checked ? "cursor-default " : "cursor-pointer ") +
                  (isSelectedCorrect
                    ? "border-2 border-green-600 bg-green-50 dark:border-green-400 dark:bg-green-950/40"
                    : isSelectedIncorrect
                      ? "border-2 border-red-600 bg-red-50 dark:border-red-400 dark:bg-red-950/40"
                      : isCorrectWhenUserIncorrect
                        ? "border-2 border-green-600 bg-green-50 dark:border-green-400 dark:bg-green-950/40"
                      : "border border-black/8 hover:bg-black/3 dark:border-white/[.145] dark:hover:bg-white/6")
                }
              >
                <input
                  id={inputId}
                  name={`q-${currentQuestionId}`}
                  type="radio"
                  value={key}
                  checked={checked}
                  disabled={!!currentAnswer?.checked}
                  onChange={() => selectOption(currentQuestionId, key)}
                  className="mt-1"
                />
                <span className="text-sm leading-6">
                  <span className="font-semibold">{key}.</span> {label}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!currentAnswer?.checked && (
            <button
              type="button"
              onClick={() => checkAnswer(currentQuestionId)}
              disabled={!currentAnswer?.selected}
              className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check
            </button>
          )}

          {currentAnswer?.checked && !isLast && (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/8 px-5 text-sm font-medium transition-colors hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-white/6"
            >
              Next
            </button>
          )}

          {currentAnswer?.checked && isLast && (
            <button
              type="button"
              onClick={() => setPhase("results")}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/8 px-5 text-sm font-medium transition-colors hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:hover:bg-white/6"
            >
              Results
            </button>
          )}
        </div>

        {currentAnswer?.checked && currentQuestion.explanation && (
          <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 ring-1 ring-blue-200/70 dark:border-blue-400/60 dark:bg-blue-500/15 dark:text-blue-50 dark:ring-blue-400/30">
            <div className="border-l-4 border-blue-500 pl-3">
              <h3 className="text-sm font-semibold tracking-wide">Explanation</h3>
              <p className="mt-1 text-sm leading-6 text-blue-900 dark:text-blue-100">
                {currentQuestion.explanation}
              </p>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
