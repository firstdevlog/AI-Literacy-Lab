// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  importQuestionFile,
  parseQuestionImport,
  readQuestionFiles,
  safeImportBasename,
} from "../../scripts/question-files";
import {
  CATEGORIES,
  createSession,
  evaluateSession,
  summarizeResults,
  validateAssessmentSession,
  validateEvaluationResult,
  validateQuestionBank,
} from "./index";
import type { Category, Difficulty, Question } from "./types";

function makeQuestion(
  id: string,
  category: Category = "fundamentals",
  difficulty: Difficulty = "beginner",
): Question {
  return {
    id,
    stage: 1,
    type: "single_choice",
    category,
    difficulty,
    stem: `${id}: 업무에 AI를 사용할 때 적절한 행동은?`,
    options: [
      { id: "a", text: "결과를 검증한다." },
      { id: "b", text: "항상 신뢰한다." },
      { id: "c", text: "출처를 확인하지 않는다." },
      { id: "d", text: "민감정보를 공개한다." },
    ],
    correctOptionId: "a",
    explanation: "결과와 출처를 검증해야 합니다.",
    optionExplanations: {
      a: "출처와 결과 확인이 필요합니다.",
      b: "항상 정확하지 않습니다.",
      c: "출처 확인이 필요합니다.",
      d: "민감정보를 보호해야 합니다.",
    },
    tags: ["검증"],
    provenance: "original",
    version: 1,
    status: "published",
  };
}

function seededRandom(seed = 42) {
  let value = seed;
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function balancedBank(): Question[] {
  return CATEGORIES.flatMap((category) =>
    (["beginner", "intermediate", "advanced"] as Difficulty[]).flatMap(
      (difficulty) =>
        [0, 1, 2].map((index) =>
          makeQuestion(
            `${category}-${difficulty}-${index}`,
            category,
            difficulty,
          ),
        ),
    ),
  );
}

describe("문제 데이터 검증", () => {
  it("독립된 문항을 검증하고 원본과 분리된 배열을 반환한다", () => {
    const input = [makeQuestion("q1")];
    const parsed = validateQuestionBank(input);
    expect(parsed).toEqual(input);
    expect(parsed[0]).not.toBe(input[0]);
  });

  it.each([
    ["중복 문제 ID", () => [makeQuestion("q1"), makeQuestion("q1")]],
    [
      "중복 선택지 ID",
      () => [
        {
          ...makeQuestion("q1"),
          options: [
            { id: "a", text: "하나" },
            { id: "a", text: "둘" },
          ],
        },
      ],
    ],
    ["없는 정답 ID", () => [{ ...makeQuestion("q1"), correctOptionId: "z" }]],
    [
      "오답 해설 누락",
      () => [{ ...makeQuestion("q1"), optionExplanations: { a: "정답 해설" } }],
    ],
    [
      "한 개의 선택지",
      () => [{ ...makeQuestion("q1"), options: [{ id: "a", text: "하나" }] }],
    ],
    [
      "유효하지 않은 영역",
      () => [{ ...makeQuestion("q1"), category: "unknown" }],
    ],
    [
      "유효하지 않은 난이도",
      () => [{ ...makeQuestion("q1"), difficulty: "expert" }],
    ],
    ["출처 누락", () => [{ ...makeQuestion("q1"), provenance: undefined }]],
    ["후속 단계 문항", () => [{ ...makeQuestion("q1"), stage: 2 }]],
    ["버전 누락", () => [{ ...makeQuestion("q1"), version: 0 }]],
    ["키워드 누락", () => [{ ...makeQuestion("q1"), tags: [] }]],
    [
      "알 수 없는 필드",
      () => [{ ...makeQuestion("q1"), unsafeField: "value" }],
    ],
  ])("%s 데이터를 거부한다", (_, input) => {
    expect(() => validateQuestionBank(input())).toThrow(
      "문제 데이터 검증에 실패했습니다.",
    );
  });
});

describe("문항 출제", () => {
  it("빈 문제은행과 필터 결과가 없는 경우 원인을 안내한다", () => {
    expect(() => createSession([], { mode: "learning", count: 10 })).toThrow(
      "출제 가능한 문제가 없습니다",
    );
    expect(() =>
      createSession([makeQuestion("q1")], {
        mode: "learning",
        count: 10,
        categories: ["security"],
      }),
    ).toThrow("출제 가능한 문제가 없습니다");
    expect(() =>
      createSession([makeQuestion("q1")], {
        mode: "learning",
        count: 10,
        questionIds: [],
      }),
    ).toThrow("출제 가능한 문제가 없습니다");
  });

  it("문제 수 부족 시 가능한 수로 줄이고 검토 중인 문항을 제외한다", () => {
    const bank = [
      makeQuestion("q1"),
      { ...makeQuestion("q2"), status: "review" as const },
    ];
    const session = createSession(
      bank,
      { mode: "learning", count: 20 },
      1000,
      seededRandom(),
    );
    expect(session.questionIds).toEqual(["q1"]);
    expect(session.deadlineAt).toBeNull();
  });

  it("영역을 고르게 선정하고 난이도 분포도 고려한다", () => {
    const session = createSession(
      balancedBank(),
      { mode: "assessment", count: 24 },
      1000,
      seededRandom(),
    );
    expect(new Set(session.questionIds).size).toBe(24);
    for (const category of CATEGORIES)
      expect(
        session.questions.filter((question) => question.category === category),
      ).toHaveLength(3);
    const counts = ["beginner", "intermediate", "advanced"].map(
      (difficulty) =>
        session.questions.filter(
          (question) => question.difficulty === difficulty,
        ).length,
    );
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(session.deadlineAt).toBe(1000 + 25 * 60 * 1000);
  });

  it("가능하면 직전 문항을 피하고 부족할 때만 재사용한다", () => {
    const bank = Array.from({ length: 6 }, (_, index) =>
      makeQuestion(`q${index}`),
    );
    const previousQuestionIds = ["q0", "q1", "q2"];
    const fresh = createSession(
      bank,
      { mode: "learning", count: 3, previousQuestionIds },
      1000,
      seededRandom(),
    );
    expect(
      fresh.questionIds.every((id) => !previousQuestionIds.includes(id)),
    ).toBe(true);
    const fallback = createSession(
      bank,
      { mode: "learning", count: 5, previousQuestionIds },
      1000,
      seededRandom(),
    );
    expect(fallback.questionIds).toHaveLength(5);
    expect(
      fallback.questionIds.filter((id) => previousQuestionIds.includes(id)),
    ).toHaveLength(2);
  });

  it("범위·난이도·특정 문항 필터를 적용한다", () => {
    const session = createSession(
      balancedBank(),
      {
        mode: "learning",
        count: 20,
        categories: ["security"],
        difficulty: "advanced",
        questionIds: ["security-advanced-0", "security-advanced-2"],
      },
      1000,
      seededRandom(),
    );
    expect([...session.questionIds].sort()).toEqual([
      "security-advanced-0",
      "security-advanced-2",
    ]);
  });

  it("새로고침 스냅샷은 문항과 선택지 순서를 유지하며 원본을 변경하지 않는다", () => {
    const bank = balancedBank();
    const original = JSON.stringify(bank);
    const first = createSession(
      bank,
      { mode: "assessment", count: 20 },
      1000,
      seededRandom(),
    );
    const same = createSession(
      bank,
      { mode: "assessment", count: 20 },
      1000,
      seededRandom(),
    );
    expect(same).toEqual(first);
    const restored = validateAssessmentSession(
      JSON.parse(JSON.stringify(first)) as unknown,
    );
    expect(restored.questionIds).toEqual(first.questionIds);
    expect(restored.displayedOptionOrder).toEqual(first.displayedOptionOrder);
    expect(
      Object.values(first.displayedOptionOrder).some(
        (order) => order.join("") !== "abcd",
      ),
    ).toBe(true);
    expect(JSON.stringify(bank)).toBe(original);
  });

  it("학습은 제한시간이 없고 모의평가는 제한 해제를 지원한다", () => {
    expect(
      createSession(
        [makeQuestion("q1")],
        { mode: "learning", count: 1, timeLimitSeconds: 20 },
        1000,
      ).deadlineAt,
    ).toBeNull();
    expect(
      createSession(
        [makeQuestion("q1")],
        { mode: "assessment", count: 1, timeLimitSeconds: null },
        1000,
      ).deadlineAt,
    ).toBeNull();
    expect(() =>
      createSession([makeQuestion("q1")], { mode: "assessment", count: 0 }),
    ).toThrow("문항 수");
    expect(() =>
      createSession(
        [makeQuestion("q1")],
        { mode: "assessment", count: 1 },
        1000,
        () => 1,
      ),
    ).toThrow("무작위 함수");
  });
});

describe("순수 채점과 스냅샷", () => {
  it("정답·선택 오답·미응답을 구분하며 전체 문항 기준으로 채점한다", () => {
    const session = createSession(
      [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3", "security")],
      { mode: "learning", count: 3 },
      1000,
      seededRandom(),
    );
    session.answers = { q1: "a", q2: "b" };
    const result = evaluateSession(session, 6500);
    expect(result).toMatchObject({
      correctCount: 1,
      incorrectCount: 1,
      unansweredCount: 1,
      totalQuestions: 3,
      score: 33.3,
      accuracy: 33.3,
      durationSeconds: 5,
    });
    expect(result.wrongQuestionIds).toEqual(
      expect.arrayContaining(["q2", "q3"]),
    );
    expect(
      result.categoryResults.find((entry) => entry.category === "fundamentals"),
    ).toMatchObject({ total: 2, correct: 1, accuracy: 50 });
    expect(
      result.categoryResults.find((entry) => entry.category === "security"),
    ).toMatchObject({ total: 1, correct: 0, accuracy: 0 });
  });

  it("제출 전후 원본 변경이 결과를 수정하지 못하며 중첩 스냅샷을 고정한다", () => {
    const bank = [makeQuestion("q1")];
    const session = createSession(
      bank,
      { mode: "learning", count: 1 },
      1000,
      seededRandom(),
    );
    session.answers.q1 = "a";
    bank[0].stem = "변경된 원본";
    const result = evaluateSession(session, 2000);
    session.questions[0].stem = "변경된 응시 문항";
    session.answers.q1 = "b";
    expect(result.questions[0].stem).toContain("q1:");
    expect(result.answers.q1).toBe("a");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.questions[0].options)).toBe(true);
    expect(() => {
      result.answers.q1 = "b";
    }).toThrow();
    expect(result.score).toBe(100);
  });

  it("만료 제출 시 종료 시각으로 제한하고 역행한 시계는 0초로 처리한다", () => {
    const session = createSession(
      [makeQuestion("q1")],
      { mode: "assessment", count: 1, timeLimitSeconds: 60 },
      10_000,
      seededRandom(),
    );
    expect(evaluateSession(session, 999_000)).toMatchObject({
      submittedAt: 70_000,
      durationSeconds: 60,
      unansweredCount: 1,
    });
    expect(evaluateSession(session, 100)).toMatchObject({
      submittedAt: 10_000,
      durationSeconds: 0,
    });
  });

  it("응시에 없는 답안, 잘못된 선택지 및 선택지 순서 변조를 거부한다", () => {
    const session = createSession(
      [makeQuestion("q1")],
      { mode: "learning", count: 1 },
      1000,
      seededRandom(),
    );
    expect(() =>
      evaluateSession({ ...session, answers: { unknown: "a" } }),
    ).toThrow("답안");
    expect(() => evaluateSession({ ...session, answers: { q1: "z" } })).toThrow(
      "선택지",
    );
    expect(() =>
      evaluateSession({
        ...session,
        displayedOptionOrder: { q1: ["a", "a", "c", "d"] },
      }),
    ).toThrow("선택지 순서");
  });

  it("저장 결과의 조작된 점수·영역·문항 버전을 거부한다", () => {
    const session = createSession(
      [makeQuestion("q1")],
      { mode: "learning", count: 1 },
      1000,
      seededRandom(),
    );
    const result = evaluateSession(session, 2000);
    expect(() => validateEvaluationResult({ ...result, score: 100 })).toThrow(
      "채점 결과",
    );
    expect(() =>
      validateEvaluationResult({ ...result, categoryResults: [] }),
    ).toThrow("영역별 결과");
    expect(() =>
      validateEvaluationResult({ ...result, questionVersion: { q1: 2 } }),
    ).toThrow("버전");
  });

  it("가져온 날짜가 JS Date 범위를 벗어나면 렌더링 전에 거부한다", () => {
    const session = createSession(
      [makeQuestion("q1")],
      { mode: "learning", count: 1 },
      1000,
      seededRandom(),
    );
    const result = evaluateSession(session, 1000);
    expect(() =>
      validateAssessmentSession({ ...session, startedAt: 1e20 }),
    ).toThrow("날짜가 지원하는 범위");
    expect(() =>
      validateEvaluationResult({
        ...result,
        startedAt: 1e20,
        submittedAt: 1e20,
      }),
    ).toThrow("날짜가 지원하는 범위");
    expect(() =>
      validateAssessmentSession({
        ...session,
        mode: "assessment",
        deadlineAt: 1e20,
      }),
    ).toThrow("날짜가 지원하는 범위");
  });

  it.each(["unsafe/path", "unsafe#hash", "unsafe?query", "unsafe route"])(
    "라우트에 사용할 수 없는 세션 ID %s를 거부한다",
    (sessionId) => {
      const session = createSession(
        [makeQuestion("q1")],
        { mode: "learning", count: 1 },
        1000,
        seededRandom(),
      );
      expect(() =>
        validateAssessmentSession({ ...session, sessionId }),
      ).toThrow("ID에는");
      expect(() =>
        validateEvaluationResult({
          ...evaluateSession(session, 1000),
          sessionId,
        }),
      ).toThrow("ID에는");
    },
  );
});

describe("개인 학습 분석", () => {
  it("이력 없는 분석은 실제 Empty State를 위한 null 통계만 반환한다", () => {
    expect(summarizeResults([])).toEqual({
      attemptCount: 0,
      latestScore: null,
      bestScore: null,
      averageScore: null,
      categoryResults: [],
      repeatedMistakes: [],
    });
  });

  it("최신 시각·영역 누적 가중치·반복 오답으로 분석한다", () => {
    const first = createSession(
      [makeQuestion("q1")],
      { mode: "learning", count: 1 },
      1000,
      seededRandom(),
    );
    const second = createSession(
      [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")],
      { mode: "learning", count: 3 },
      3000,
      seededRandom(),
    );
    second.answers = { q2: "a", q3: "a" };
    const analytics = summarizeResults([
      evaluateSession(second, 4000),
      evaluateSession(first, 2000),
    ]);
    expect(analytics).toMatchObject({
      attemptCount: 2,
      latestScore: 66.7,
      bestScore: 66.7,
      averageScore: 33.4,
      repeatedMistakes: [{ questionId: "q1", count: 2 }],
    });
    expect(analytics.categoryResults).toEqual([
      { category: "fundamentals", total: 4, correct: 2, accuracy: 50 },
    ]);
  });
});

describe("문항 임포트 형식", () => {
  it("JSON·JSONL·명시적 Markdown JSON 블록을 같은 문항으로 검증한다", () => {
    const question = makeQuestion("q1");
    const array = JSON.stringify([question]);
    expect(parseQuestionImport(array, ".json")).toEqual([question]);
    expect(
      parseQuestionImport(`\n${JSON.stringify(question)}\n`, ".jsonl"),
    ).toEqual([question]);
    expect(
      parseQuestionImport(
        `# 사용 권한이 있는 문항\n\n\`\`\`json\n${array}\n\`\`\``,
        ".md",
      ),
    ).toEqual([question]);
  });

  it("잘못된 형식과 경로 요소를 거부하거나 안전하게 정규화한다", () => {
    expect(() => parseQuestionImport("{broken}", ".json")).toThrow("JSON 형식");
    expect(() => parseQuestionImport("[]", ".json")).toThrow("비어 있습니다");
    expect(() => parseQuestionImport("# 본문", ".md")).toThrow("코드 블록");
    expect(() => parseQuestionImport("[]", ".txt")).toThrow("지원하는 확장자");
    expect(safeImportBasename("../../My New Questions.JSON")).toBe(
      "my-new-questions.json",
    );
    expect(safeImportBasename("../../.json")).toMatch(/^[a-z0-9-]+\.json$/);
  });

  it("파일을 검증 후 추가하며 중복 ID와 파일 덮어쓰기를 막는다", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "ai-literacy-import-"));
    const bank = path.join(directory, "bank");
    const source = path.join(directory, "new.json");
    try {
      await writeFile(source, JSON.stringify([makeQuestion("q1")]));
      const imported = await importQuestionFile(source, bank);
      expect(imported.count).toBe(1);
      expect(
        (await readQuestionFiles(bank)).map((question) => question.id),
      ).toEqual(["q1"]);
      const before = await readFile(imported.destination, "utf8");
      const duplicateSource = path.join(directory, "duplicate.json");
      await writeFile(duplicateSource, JSON.stringify([makeQuestion("q1")]));
      await expect(importQuestionFile(duplicateSource, bank)).rejects.toThrow(
        "중복",
      );
      await writeFile(source, JSON.stringify([makeQuestion("q2")]));
      await expect(importQuestionFile(source, bank)).rejects.toThrow(
        "이미 있습니다",
      );
      expect(await readFile(imported.destination, "utf8")).toBe(before);
      const invalidBank = path.join(directory, "invalid");
      await mkdir(invalidBank);
      await writeFile(path.join(invalidBank, "broken.json"), "[invalid]");
      await expect(readQuestionFiles(invalidBank)).rejects.toThrow(
        "broken.json",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
