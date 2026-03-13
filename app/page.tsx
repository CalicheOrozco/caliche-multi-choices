import path from "node:path";
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";

import Quiz, { type QuizQuestion } from "./components/Quiz";

export const dynamic = "force-dynamic";

async function loadQuestions(): Promise<QuizQuestion[]> {
  const jsonPath = path.join(process.cwd(), "public", "cimQuestion.json");
  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) return [];

  return parsed.filter((q): q is QuizQuestion => {
    if (!q || typeof q !== "object") return false;
    const maybe = q as Partial<QuizQuestion>;
    return (
      (typeof maybe.id === "number" || typeof maybe.id === "string") &&
      typeof maybe.question === "string" &&
      !!maybe.options &&
      typeof maybe.options === "object" &&
      typeof maybe.correct_answer === "string"
    );
  });
}

export default async function Home() {
  const questions = await loadQuestions();
  const seed = randomBytes(4).readUInt32LE(0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            CIM - Multiple-choice questions
          </h1>
          <p className="max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Select an option and press “Check” to validate.
          </p>
        </header>

        {questions.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Could not load questions from /public/cimQuestion.json.
          </p>
        ) : (
          <Quiz questions={questions} seed={seed} />
        )}
      </main>
    </div>
  );
}
