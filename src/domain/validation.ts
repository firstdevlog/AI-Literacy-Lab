import { z } from "zod";
import {
  CATEGORIES,
  type AssessmentSession,
  type EvaluationResult,
  type Question,
} from "./types";

const categorySchema = z.enum(
  CATEGORIES as [(typeof CATEGORIES)[number], ...(typeof CATEGORIES)[number][]],
);
const text = z.string().trim().min(1, "비어 있는 문자열은 사용할 수 없습니다.");
const identifier = text
  .max(120)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    "ID에는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.",
  )
  .refine(
    (value) => !["__proto__", "constructor", "prototype"].includes(value),
    "예약된 ID는 사용할 수 없습니다.",
  );
const timestamp = z
  .number()
  .finite()
  .nonnegative()
  .max(8_640_000_000_000_000, "날짜가 지원하는 범위를 벗어났습니다.");

export const questionSchema = z
  .object({
    id: identifier,
    stage: z.literal(1),
    type: z.literal("single_choice"),
    category: categorySchema,
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    stem: text,
    options: z
      .array(z.object({ id: identifier, text }).strict())
      .min(2, "선택지는 최소 2개가 필요합니다."),
    correctOptionId: identifier,
    explanation: text,
    optionExplanations: z.record(text),
    tags: z.array(text).min(1, "학습 키워드를 하나 이상 입력하세요."),
    provenance: z.enum(["original", "licensed", "user_provided"]),
    version: z.number().int().positive(),
    status: z.enum(["published", "review"]),
  })
  .strict()
  .superRefine((question, context) => {
    const ids = question.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "선택지 ID가 중복됩니다.",
      });
    if (!ids.includes(question.correctOptionId))
      context.addIssue({
        code: "custom",
        path: ["correctOptionId"],
        message: "정답 ID가 선택지에 없습니다.",
      });
    for (const id of ids) {
      if (!Object.hasOwn(question.optionExplanations, id))
        context.addIssue({
          code: "custom",
          path: ["optionExplanations", id],
          message: "정답과 오답을 포함한 모든 선택지에 해설이 필요합니다.",
        });
    }
    if (
      Object.keys(question.optionExplanations).some((id) => !ids.includes(id))
    )
      context.addIssue({
        code: "custom",
        path: ["optionExplanations"],
        message: "존재하지 않는 선택지의 해설이 있습니다.",
      });
    if (new Set(question.tags).size !== question.tags.length)
      context.addIssue({
        code: "custom",
        path: ["tags"],
        message: "학습 키워드가 중복됩니다.",
      });
  });

export const questionBankSchema = z
  .array(questionSchema)
  .superRefine((questions, context) => {
    const ids = new Set<string>();
    questions.forEach((question, index) => {
      if (ids.has(question.id))
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `문제 ID '${question.id}'가 중복됩니다.`,
        });
      ids.add(question.id);
    });
  });

const snapshotShape = {
  sessionId: identifier,
  assessmentId: z.literal("stage-1"),
  mode: z.enum(["learning", "assessment"]),
  startedAt: timestamp,
  questions: questionBankSchema.refine(
    (questions) => questions.length > 0,
    "응시 문항이 비어 있습니다.",
  ),
  questionIds: z.array(identifier),
  displayedOptionOrder: z.record(z.array(identifier)),
  answers: z.record(identifier),
  questionVersion: z.record(z.number().int().positive()),
};

type Snapshot = Pick<
  AssessmentSession,
  | "questions"
  | "questionIds"
  | "displayedOptionOrder"
  | "answers"
  | "questionVersion"
>;

function validateSnapshot(snapshot: Snapshot, context: z.RefinementCtx) {
  const ids = snapshot.questions.map((question) => question.id);
  if (JSON.stringify(ids) !== JSON.stringify(snapshot.questionIds))
    context.addIssue({
      code: "custom",
      path: ["questionIds"],
      message: "문제 스냅샷과 문항 순서가 일치하지 않습니다.",
    });
  for (const key of ["displayedOptionOrder", "questionVersion"] as const) {
    if (!sameMembers(Object.keys(snapshot[key]), ids))
      context.addIssue({
        code: "custom",
        path: [key],
        message: "문항별 저장 데이터가 일치하지 않습니다.",
      });
  }
  if (Object.keys(snapshot.answers).some((id) => !ids.includes(id)))
    context.addIssue({
      code: "custom",
      path: ["answers"],
      message: "응시에 없는 문제의 답안이 있습니다.",
    });
  for (const question of snapshot.questions) {
    if (question.status !== "published")
      context.addIssue({
        code: "custom",
        path: ["questions"],
        message: "검토 중인 문제는 응시에 포함할 수 없습니다.",
      });
    if (snapshot.questionVersion[question.id] !== question.version)
      context.addIssue({
        code: "custom",
        path: ["questionVersion", question.id],
        message: "저장된 문항 버전이 일치하지 않습니다.",
      });
    if (
      !sameMembers(
        snapshot.displayedOptionOrder[question.id] ?? [],
        question.options.map((option) => option.id),
      )
    )
      context.addIssue({
        code: "custom",
        path: ["displayedOptionOrder", question.id],
        message: "선택지 순서가 문항의 선택지와 일치하지 않습니다.",
      });
    const answer = snapshot.answers[question.id];
    if (
      answer !== undefined &&
      !question.options.some((option) => option.id === answer)
    )
      context.addIssue({
        code: "custom",
        path: ["answers", question.id],
        message: "답안에 유효하지 않은 선택지 ID가 있습니다.",
      });
  }
}

function sameMembers(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((id) => right.includes(id))
  );
}

export const assessmentSessionSchema = z
  .object({
    ...snapshotShape,
    deadlineAt: timestamp.nullable(),
    currentIndex: z.number().int().nonnegative(),
    revealedQuestionIds: z.array(identifier),
  })
  .strict()
  .superRefine((session, context) => {
    validateSnapshot(session, context);
    if (session.currentIndex >= session.questions.length)
      context.addIssue({
        code: "custom",
        path: ["currentIndex"],
        message: "현재 문항 번호가 응시 범위를 벗어났습니다.",
      });
    if (
      session.deadlineAt !== null &&
      (session.mode === "learning" || session.deadlineAt < session.startedAt)
    )
      context.addIssue({
        code: "custom",
        path: ["deadlineAt"],
        message: "응시 제한시간이 유효하지 않습니다.",
      });
    if (
      new Set(session.revealedQuestionIds).size !==
        session.revealedQuestionIds.length ||
      session.revealedQuestionIds.some(
        (id) => !session.questionIds.includes(id),
      )
    )
      context.addIssue({
        code: "custom",
        path: ["revealedQuestionIds"],
        message: "해설 열람 문항이 유효하지 않습니다.",
      });
    if (session.mode === "assessment" && session.revealedQuestionIds.length > 0)
      context.addIssue({
        code: "custom",
        path: ["revealedQuestionIds"],
        message: "모의평가 제출 전에는 해설을 열람할 수 없습니다.",
      });
  });

const categoryResultSchema = z
  .object({
    category: categorySchema,
    total: z.number().int().positive(),
    correct: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(100),
  })
  .strict();

export function percentage(correct: number, total: number) {
  return total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
}

export const evaluationResultSchema = z
  .object({
    ...snapshotShape,
    submittedAt: timestamp,
    durationSeconds: z.number().int().nonnegative(),
    totalQuestions: z.number().int().positive(),
    correctCount: z.number().int().nonnegative(),
    incorrectCount: z.number().int().nonnegative(),
    unansweredCount: z.number().int().nonnegative(),
    score: z.number().min(0).max(100),
    accuracy: z.number().min(0).max(100),
    categoryResults: z.array(categoryResultSchema),
    wrongQuestionIds: z.array(identifier),
  })
  .strict()
  .superRefine((result, context) => {
    validateSnapshot(result, context);
    const correct = result.questions.filter(
      (question) => result.answers[question.id] === question.correctOptionId,
    ).length;
    const unanswered = result.questions.filter(
      (question) => !Object.hasOwn(result.answers, question.id),
    ).length;
    const wrongIds = result.questions
      .filter(
        (question) => result.answers[question.id] !== question.correctOptionId,
      )
      .map((question) => question.id);
    const expected = {
      totalQuestions: result.questions.length,
      correctCount: correct,
      incorrectCount: result.questions.length - correct - unanswered,
      unansweredCount: unanswered,
      score: percentage(correct, result.questions.length),
      accuracy: percentage(correct, result.questions.length),
      durationSeconds: Math.floor(
        Math.max(0, result.submittedAt - result.startedAt) / 1000,
      ),
    };
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      if (result[key] !== expected[key])
        context.addIssue({
          code: "custom",
          path: [key],
          message: "문항과 답안으로 계산한 채점 결과가 일치하지 않습니다.",
        });
    }
    if (result.submittedAt < result.startedAt)
      context.addIssue({
        code: "custom",
        path: ["submittedAt"],
        message: "제출 시각이 시작 시각보다 빠릅니다.",
      });
    if (!sameMembers(result.wrongQuestionIds, wrongIds))
      context.addIssue({
        code: "custom",
        path: ["wrongQuestionIds"],
        message: "오답 목록이 채점 결과와 일치하지 않습니다.",
      });
    const categories = CATEGORIES.filter((category) =>
      result.questions.some((question) => question.category === category),
    );
    if (
      !sameMembers(
        result.categoryResults.map((entry) => entry.category),
        categories,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["categoryResults"],
        message: "영역별 결과 목록이 문항과 일치하지 않습니다.",
      });
    for (const entry of result.categoryResults) {
      const questions = result.questions.filter(
        (question) => question.category === entry.category,
      );
      const count = questions.filter(
        (question) => result.answers[question.id] === question.correctOptionId,
      ).length;
      if (
        entry.total !== questions.length ||
        entry.correct !== count ||
        entry.accuracy !== percentage(count, questions.length)
      )
        context.addIssue({
          code: "custom",
          path: ["categoryResults"],
          message: "영역별 채점 결과가 일치하지 않습니다.",
        });
    }
  });

function parseWithMessage<T>(
  schema: z.ZodType<T>,
  input: unknown,
  title: string,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".") || "데이터"}: ${issue.message}`)
      .join("\n");
    throw new Error(`${title}\n${details}`);
  }
  return parsed.data;
}

export function validateQuestionBank(input: unknown): Question[] {
  return parseWithMessage(
    questionBankSchema,
    input,
    "문제 데이터 검증에 실패했습니다.",
  );
}

export function validateAssessmentSession(input: unknown): AssessmentSession {
  return parseWithMessage(
    assessmentSessionSchema,
    input,
    "응시 데이터 검증에 실패했습니다.",
  );
}

export function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach((child) => freezeSnapshot(child));
  }
  return value;
}

export function validateEvaluationResult(input: unknown): EvaluationResult {
  return freezeSnapshot(
    parseWithMessage(
      evaluationResultSchema,
      input,
      "응시 결과 검증에 실패했습니다.",
    ),
  );
}
