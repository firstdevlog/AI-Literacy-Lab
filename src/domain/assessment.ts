import {
  CATEGORIES,
  type AssessmentConfig,
  type AssessmentSession,
  type CategoryResult,
  type Difficulty,
  type EvaluationResult,
  type LearningAnalytics,
  type Question,
} from "./types";
import {
  freezeSnapshot,
  percentage,
  validateAssessmentSession,
  validateEvaluationResult,
  validateQuestionBank,
} from "./validation";

const DEFAULT_ASSESSMENT_SECONDS = 25 * 60;
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

function draw(random: () => number) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1)
    throw new Error("무작위 함수는 0 이상 1 미만의 값을 반환해야 합니다.");
  return value;
}

/** Fisher–Yates only runs during creation; its persisted output is never regenerated. */
function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(draw(random) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function selectBalanced(
  questions: Question[],
  count: number,
  previousIds: Set<string>,
  random: () => number,
) {
  let remaining = shuffle(questions, random);
  const selected: Question[] = [];
  const categoryCounts = new Map(CATEGORIES.map((category) => [category, 0]));
  const difficultyCounts = new Map(
    DIFFICULTIES.map((difficulty) => [difficulty, 0]),
  );
  while (selected.length < count && remaining.length > 0) {
    // Fresh questions take priority whenever possible, without retry loops.
    const fresh = remaining.filter((question) => !previousIds.has(question.id));
    const pool = fresh.length > 0 ? fresh : remaining;
    const lowestCategoryCount = Math.min(
      ...pool.map((question) => categoryCounts.get(question.category) ?? 0),
    );
    const categoryPool = pool.filter(
      (question) =>
        categoryCounts.get(question.category) === lowestCategoryCount,
    );
    const lowestDifficultyCount = Math.min(
      ...categoryPool.map(
        (question) => difficultyCounts.get(question.difficulty) ?? 0,
      ),
    );
    const question = categoryPool.find(
      (candidate) =>
        difficultyCounts.get(candidate.difficulty) === lowestDifficultyCount,
    )!;
    selected.push(question);
    categoryCounts.set(
      question.category,
      (categoryCounts.get(question.category) ?? 0) + 1,
    );
    difficultyCounts.set(
      question.difficulty,
      (difficultyCounts.get(question.difficulty) ?? 0) + 1,
    );
    remaining = remaining.filter((candidate) => candidate.id !== question.id);
  }
  return shuffle(selected, random);
}

export function createSession(
  questions: Question[],
  config: AssessmentConfig,
  now = Date.now(),
  random: () => number = Math.random,
): AssessmentSession {
  const bank = validateQuestionBank(questions);
  if (!Number.isFinite(now) || now < 0)
    throw new Error("응시 시작 시각이 올바르지 않습니다.");
  if (!["learning", "assessment"].includes(config.mode))
    throw new Error("응시 모드가 올바르지 않습니다.");
  if (!Number.isFinite(config.count) || config.count < 1)
    throw new Error("문항 수는 1 이상이어야 합니다.");
  if (config.categories?.some((category) => !CATEGORIES.includes(category)))
    throw new Error("출제 영역이 올바르지 않습니다.");
  if (
    config.difficulty !== undefined &&
    !DIFFICULTIES.includes(config.difficulty)
  )
    throw new Error("출제 난이도가 올바르지 않습니다.");
  const filtered = bank.filter(
    (question) =>
      question.status === "published" &&
      (!config.categories?.length ||
        config.categories.includes(question.category)) &&
      (!config.difficulty || question.difficulty === config.difficulty) &&
      (!config.questionIds || config.questionIds.includes(question.id)),
  );
  if (filtered.length === 0)
    throw new Error(
      "조건에 맞는 출제 가능한 문제가 없습니다. 영역이나 난이도를 바꾸어 주세요.",
    );
  const count = Math.min(Math.floor(config.count), filtered.length);
  const selected = selectBalanced(
    filtered,
    count,
    new Set(config.previousQuestionIds),
    random,
  );
  const timeLimit =
    config.timeLimitSeconds === undefined
      ? DEFAULT_ASSESSMENT_SECONDS
      : config.timeLimitSeconds;
  if (timeLimit !== null && (!Number.isFinite(timeLimit) || timeLimit <= 0))
    throw new Error("제한시간은 양수 또는 제한 없음이어야 합니다.");
  const deadlineAt =
    config.mode === "assessment" && timeLimit !== null
      ? now + timeLimit * 1000
      : null;
  const suffix = Array.from({ length: 3 }, () =>
    Math.floor(draw(random) * 0x100000000).toString(36),
  ).join("-");
  return validateAssessmentSession({
    sessionId: `session-${now.toString(36)}-${suffix}`,
    assessmentId: "stage-1",
    mode: config.mode,
    startedAt: now,
    deadlineAt,
    questions: selected,
    questionIds: selected.map((question) => question.id),
    displayedOptionOrder: Object.fromEntries(
      selected.map((question) => [
        question.id,
        shuffle(
          question.options.map((option) => option.id),
          random,
        ),
      ]),
    ),
    answers: {},
    currentIndex: 0,
    revealedQuestionIds: [],
    questionVersion: Object.fromEntries(
      selected.map((question) => [question.id, question.version]),
    ),
  });
}

export function evaluateSession(
  session: AssessmentSession,
  now = Date.now(),
): EvaluationResult {
  const snapshot = validateAssessmentSession(session);
  if (!Number.isFinite(now)) throw new Error("제출 시각이 올바르지 않습니다.");
  const submittedAt = Math.max(
    snapshot.startedAt,
    Math.min(now, snapshot.deadlineAt ?? Number.POSITIVE_INFINITY),
  );
  const correctCount = snapshot.questions.filter(
    (question) => snapshot.answers[question.id] === question.correctOptionId,
  ).length;
  const unansweredCount = snapshot.questions.filter(
    (question) => !Object.hasOwn(snapshot.answers, question.id),
  ).length;
  const totalQuestions = snapshot.questions.length;
  const categoryResults: CategoryResult[] = CATEGORIES.flatMap((category) => {
    const questions = snapshot.questions.filter(
      (question) => question.category === category,
    );
    if (questions.length === 0) return [];
    const correct = questions.filter(
      (question) => snapshot.answers[question.id] === question.correctOptionId,
    ).length;
    return [
      {
        category,
        total: questions.length,
        correct,
        accuracy: percentage(correct, questions.length),
      },
    ];
  });
  return validateEvaluationResult({
    sessionId: snapshot.sessionId,
    assessmentId: snapshot.assessmentId,
    mode: snapshot.mode,
    startedAt: snapshot.startedAt,
    submittedAt,
    durationSeconds: Math.floor((submittedAt - snapshot.startedAt) / 1000),
    questions: snapshot.questions,
    questionIds: snapshot.questionIds,
    displayedOptionOrder: snapshot.displayedOptionOrder,
    answers: snapshot.answers,
    questionVersion: snapshot.questionVersion,
    totalQuestions,
    correctCount,
    incorrectCount: totalQuestions - correctCount - unansweredCount,
    unansweredCount,
    score: percentage(correctCount, totalQuestions),
    accuracy: percentage(correctCount, totalQuestions),
    categoryResults,
    wrongQuestionIds: snapshot.questions
      .filter(
        (question) =>
          snapshot.answers[question.id] !== question.correctOptionId,
      )
      .map((question) => question.id),
  });
}

export function summarizeResults(
  results: EvaluationResult[],
): LearningAnalytics {
  const snapshots = results.map((result) => validateEvaluationResult(result));
  const latest = [...snapshots].sort(
    (left, right) => right.submittedAt - left.submittedAt,
  )[0];
  const mistakes = new Map<string, number>();
  for (const result of snapshots) {
    for (const id of result.wrongQuestionIds)
      mistakes.set(id, (mistakes.get(id) ?? 0) + 1);
  }
  return freezeSnapshot({
    attemptCount: snapshots.length,
    latestScore: latest?.score ?? null,
    bestScore: snapshots.length
      ? Math.max(...snapshots.map((result) => result.score))
      : null,
    averageScore: snapshots.length
      ? Math.round(
          (snapshots.reduce((total, result) => total + result.score, 0) /
            snapshots.length) *
            10,
        ) / 10
      : null,
    categoryResults: CATEGORIES.flatMap((category) => {
      const entries = snapshots.flatMap((result) =>
        result.categoryResults.filter((entry) => entry.category === category),
      );
      const total = entries.reduce((sum, entry) => sum + entry.total, 0);
      const correct = entries.reduce((sum, entry) => sum + entry.correct, 0);
      return total
        ? [{ category, total, correct, accuracy: percentage(correct, total) }]
        : [];
    }),
    repeatedMistakes: [...mistakes.entries()]
      .filter(([, count]) => count >= 2)
      .map(([questionId, count]) => ({ questionId, count }))
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.questionId.localeCompare(right.questionId),
      ),
  });
}
