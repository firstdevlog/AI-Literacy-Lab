import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type {
  AssessmentSession,
  EvaluationResult,
} from "../../src/domain/types";

const prefix = "ai-literacy-lab:v1";

async function readProgress(page: Page) {
  return page.evaluate((storagePrefix) => {
    const head = JSON.parse(
      localStorage.getItem(`${storagePrefix}:head`) ??
        '{"generation":"default"}',
    ) as { generation: string };
    const key = `${storagePrefix}:generation:${head.generation}`;
    return {
      activeSession: (
        JSON.parse(
          localStorage.getItem(`${key}:active`) ?? '{"activeSession":null}',
        ) as { activeSession: AssessmentSession | null }
      ).activeSession,
      results: (
        JSON.parse(
          localStorage.getItem(`${key}:results`) ?? '{"results":[]}',
        ) as { results: EvaluationResult[] }
      ).results,
      bookmarks: (
        JSON.parse(
          localStorage.getItem(`${key}:bookmarks`) ?? '{"bookmarks":[]}',
        ) as { bookmarks: string[] }
      ).bookmarks,
    };
  }, prefix);
}

async function startAssessment(
  page: Page,
  mode: "learning" | "assessment" = "learning",
) {
  await page.goto("#/stage/1");
  await page
    .getByRole("radio", {
      name: mode === "learning" ? "학습 모드" : "모의평가 모드",
      exact: true,
    })
    .check();
  await page.getByLabel("문항 수", { exact: true }).selectOption("5");
  await page
    .getByRole("button", {
      name: mode === "learning" ? "학습 시작하기" : "모의평가 시작하기",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#\/assessment\/[^/]+$/);
  await expect(page.getByRole("radio").first()).toBeVisible();
  const session = (await readProgress(page)).activeSession;
  expect(session).not.toBeNull();
  expect(session?.questions).toHaveLength(5);
  return session!;
}

async function submitAssessment(page: Page) {
  await page
    .getByRole("button", { name: "제출하기", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "평가를 제출할까요?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "제출 확정", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "평가 결과", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/results\/[^/]+$/);
}

async function displayedOptions(page: Page) {
  return page.getByRole("radio").evaluateAll((radios) =>
    radios.map((radio) =>
      radio instanceof HTMLInputElement
        ? Array.from(radio.labels ?? [])
            .map((label) => label.textContent?.trim() ?? "")
            .join(" ")
        : (radio.textContent?.trim() ?? ""),
    ),
  );
}

test("dashboard offers stage 1 and clearly marks stages 2 and 3 as unavailable", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /AI를 이해하는 힘/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI 지식평가", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI 활용평가", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI 전문평가", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Coming Soon", { exact: true })).toHaveCount(2);
  const unavailableButtons = page.getByRole("button", {
    name: "준비 중",
    exact: true,
  });
  await expect(unavailableButtons).toHaveCount(2);
  await expect(unavailableButtons.nth(0)).toBeDisabled();
  await expect(unavailableButtons.nth(1)).toBeDisabled();
  await page
    .getByRole("link", { name: "내 AI 역량 알아보기", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/stage\/1$/);
  await expect(
    page.getByRole("button", { name: "학습 시작하기", exact: true }),
  ).toBeEnabled();
});

test("learning answers, question order, option order, bookmarks, and explanations survive reload", async ({
  page,
}) => {
  const session = await startAssessment(page);
  const firstQuestion = session.questions[0];
  const optionOrder = await displayedOptions(page);
  expect(optionOrder.every((text) => text.length > 0)).toBe(true);
  const selectedOption = page.getByRole("radio").first();
  await selectedOption.check();
  await expect(selectedOption).toBeChecked();
  await page
    .getByRole("button", { name: "즐겨찾기 추가", exact: true })
    .click();
  await page
    .getByRole("button", { name: "정답과 해설 보기", exact: true })
    .click();
  await expect(
    page.getByText(firstQuestion.explanation, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "다음 문제", exact: true }).click();
  await expect(
    page.getByText(session.questions[1].stem, { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio").last().check();
  await page.getByRole("button", { name: "이전 문제", exact: true }).click();
  const beforeReload = await readProgress(page);

  await page.goBack();
  await expect(page).toHaveURL(/#\/stage\/1$/);
  await expect(page.getByRole("link", { name: /이어서 풀기/ })).toBeVisible();
  await page.goForward();
  await expect(
    page.getByText(firstQuestion.stem, { exact: true }),
  ).toBeVisible();
  expect(await readProgress(page)).toEqual(beforeReload);

  await page.reload();

  await expect(
    page.getByText(firstQuestion.stem, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeChecked();
  await expect(
    page.getByRole("button", { name: "즐겨찾기 해제", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(firstQuestion.explanation, { exact: true }),
  ).toBeVisible();
  expect(await displayedOptions(page)).toEqual(optionOrder);
  const afterReload = await readProgress(page);
  expect(afterReload).toEqual(beforeReload);
  expect(afterReload.activeSession?.questionIds).toEqual(session.questionIds);
  expect(afterReload.activeSession?.displayedOptionOrder).toEqual(
    session.displayedOptionOrder,
  );
  expect(afterReload.bookmarks).toContain(firstQuestion.id);
  await page.getByRole("button", { name: /2번 문제, 응답 완료/ }).click();
  await expect(page.getByRole("radio").last()).toBeChecked();
});

test("submission scores correct, incorrect, and unanswered questions and cannot create duplicate results", async ({
  page,
}) => {
  const session = await startAssessment(page);
  const correctQuestion = session.questions[0];
  const correctOption = correctQuestion.options.find(
    (option) => option.id === correctQuestion.correctOptionId,
  )!;
  await page
    .getByRole("radio", { name: correctOption.text, exact: false })
    .check();
  await page.getByRole("button", { name: "다음 문제", exact: true }).click();
  const incorrectQuestion = session.questions[1];
  const incorrectOption = incorrectQuestion.options.find(
    (option) => option.id !== incorrectQuestion.correctOptionId,
  )!;
  await page
    .getByRole("radio", { name: incorrectOption.text, exact: false })
    .check();
  await submitAssessment(page);

  const progress = await readProgress(page);
  expect(progress.activeSession).toBeNull();
  expect(progress.results).toHaveLength(1);
  expect(progress.results[0]).toMatchObject({
    sessionId: session.sessionId,
    totalQuestions: 5,
    correctCount: 1,
    incorrectCount: 1,
    unansweredCount: 3,
    score: 20,
    accuracy: 20,
  });
  await page.getByText(correctQuestion.stem, { exact: true }).click();
  await expect(
    page.getByText(correctQuestion.explanation, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "평가 결과", exact: true }),
  ).toBeVisible();
  expect((await readProgress(page)).results).toEqual(progress.results);
  await page.goto(`#/assessment/${session.sessionId}`);
  await expect(page).toHaveURL(new RegExp(`#/results/${session.sessionId}$`));
  expect((await readProgress(page)).results).toEqual(progress.results);
});

test("all questions can be answered and a new attempt uses a new fixed question selection", async ({
  page,
}) => {
  const session = await startAssessment(page);
  for (const [index, question] of session.questions.entries()) {
    const correct = question.options.find(
      (option) => option.id === question.correctOptionId,
    )!;
    await page.getByRole("radio", { name: correct.text, exact: false }).check();
    if (index < session.questions.length - 1)
      await page
        .getByRole("button", { name: "다음 문제", exact: true })
        .click();
  }
  await submitAssessment(page);
  expect((await readProgress(page)).results[0]).toMatchObject({
    score: 100,
    correctCount: 5,
    incorrectCount: 0,
    unansweredCount: 0,
  });
  await expect(
    page.getByRole("button", { name: "오답 복습 시작", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "다시 응시하기", exact: true })
    .click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  const retry = (await readProgress(page)).activeSession!;
  expect(retry.sessionId).not.toBe(session.sessionId);
  expect(retry.mode).toBe(session.mode);
  expect(retry.questionIds).toHaveLength(5);
  expect(
    retry.questionIds.filter((id) => session.questionIds.includes(id)),
  ).toEqual([]);
});

test("category and difficulty filters show the available count when the requested bank is too small", async ({
  page,
}) => {
  await page.goto("#/stage/1");
  await page.getByLabel("출제 영역", { exact: true }).selectOption("security");
  await page.getByLabel("난이도", { exact: true }).selectOption("advanced");
  await page.getByLabel("문항 수", { exact: true }).selectOption("64");
  const availability = page.getByText(/선택 조건에서/);
  await expect(availability).toContainText("가능한 문제");
  const availableCount = Number(
    (await availability.innerText()).match(/(\d+)문항/)?.[1],
  );
  expect(availableCount).toBeGreaterThan(0);
  expect(availableCount).toBeLessThan(64);
  await page
    .getByRole("button", { name: "학습 시작하기", exact: true })
    .click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  const session = (await readProgress(page)).activeSession!;
  expect(session.questions).toHaveLength(availableCount);
  expect(new Set(session.questionIds).size).toBe(availableCount);
  expect(
    session.questions.every(
      (question) =>
        question.category === "security" && question.difficulty === "advanced",
    ),
  ).toBe(true);
});

test("mode defaults are explicit and a mock assessment can run without a deadline", async ({
  page,
}) => {
  await page.goto("#/stage/1");
  await expect(
    page.getByRole("radio", { name: "학습 모드", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("문항 수", { exact: true })).toHaveValue("10");
  await page.getByRole("radio", { name: "모의평가 모드", exact: true }).check();
  await expect(page.getByLabel("문항 수", { exact: true })).toHaveValue("20");
  await expect(
    page.getByRole("checkbox", { name: "시간 제한 사용", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "시간 제한 사용", exact: true })
    .uncheck();
  await page.getByLabel("문항 수", { exact: true }).selectOption("5");
  await page
    .getByRole("button", { name: "모의평가 시작하기", exact: true })
    .click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  expect((await readProgress(page)).activeSession).toMatchObject({
    mode: "assessment",
    deadlineAt: null,
  });
  await expect(page.getByLabel("소요 시간", { exact: true })).toBeVisible();
});

test("wrong-answer review, bookmark-only learning, and history use the saved results", async ({
  page,
}) => {
  const session = await startAssessment(page);
  const firstQuestion = session.questions[0];
  const wrongOption = firstQuestion.options.find(
    (option) => option.id !== firstQuestion.correctOptionId,
  )!;
  await page
    .getByRole("radio", { name: wrongOption.text, exact: false })
    .check();
  await page
    .getByRole("button", { name: "즐겨찾기 추가", exact: true })
    .click();
  await submitAssessment(page);
  const firstResult = (await readProgress(page)).results[0];
  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("link", { name: "복습 노트", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: firstQuestion.stem, exact: true }),
  ).toBeVisible();
  await page.goto(`#/results/${firstResult.sessionId}`);
  await page
    .getByRole("button", { name: "오답 복습 시작", exact: true })
    .click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  const wrongReview = (await readProgress(page)).activeSession!;
  expect(wrongReview.mode).toBe("learning");
  expect(wrongReview.deadlineAt).toBeNull();
  expect([...wrongReview.questionIds].sort()).toEqual(
    [...firstResult.wrongQuestionIds].sort(),
  );
  await submitAssessment(page);

  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("link", { name: "복습 노트", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "복습 노트", exact: true }),
  ).toBeVisible();
  const firstNote = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: firstQuestion.stem, exact: true }),
    });
  await firstNote.getByText("정답과 해설 확인", { exact: true }).click();
  await expect(
    firstNote.getByText(firstQuestion.explanation, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "복습 유형" })
    .getByRole("button", { name: /즐겨찾기/ })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: firstQuestion.stem, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "즐겨찾기 학습 시작", exact: true })
    .click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  expect((await readProgress(page)).activeSession?.questionIds).toEqual([
    firstQuestion.id,
  ]);
  await submitAssessment(page);

  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("link", { name: "학습 기록", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "학습 기록", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
  expect((await readProgress(page)).results).toHaveLength(3);
  await page
    .getByRole("table")
    .getByRole("link", { name: /평가 결과 보기/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "평가 결과", exact: true }),
  ).toBeVisible();
});

test("JSON backups export and restore history while invalid and future-version imports preserve records", async ({
  page,
}, testInfo) => {
  await startAssessment(page);
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "즐겨찾기 추가", exact: true })
    .click();
  await submitAssessment(page);
  const original = await readProgress(page);
  await page
    .getByRole("navigation", { name: "주요 메뉴" })
    .getByRole("link", { name: "학습 기록", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "내보내기", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(
    /^ai-literacy-lab-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const backupPath = testInfo.outputPath("progress-backup.json");
  await download.saveAs(backupPath);
  const exported = await readFile(backupPath, "utf8");
  expect(JSON.parse(exported)).toEqual({ version: 1, ...original });

  async function importBackup(contents: string) {
    await page
      .getByLabel("학습 기록 백업 파일", { exact: true })
      .setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(contents),
      });
    const dialog = page.getByRole("dialog", {
      name: "백업에서 기록을 복원할까요?",
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "가져오기 확정", exact: true })
      .click();
  }

  for (const invalid of [
    "{invalid-json",
    JSON.stringify({ version: 99, ...original }),
  ]) {
    await importBackup(invalid);
    await expect(page.getByRole("alert")).toContainText(
      "기존 기록은 변경되지 않았습니다.",
    );
    expect(await readProgress(page)).toEqual(original);
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  }
  await importBackup(
    JSON.stringify({
      version: 1,
      activeSession: null,
      results: [],
      bookmarks: [],
    }),
  );
  await expect(
    page.getByText("아직 응시한 평가가 없어요", { exact: true }),
  ).toBeVisible();
  expect(await readProgress(page)).toEqual({
    activeSession: null,
    results: [],
    bookmarks: [],
  });
  await importBackup(exported);
  await expect(page.getByRole("status")).toContainText(
    "백업에서 학습 기록을 복원했습니다.",
  );
  expect(await readProgress(page)).toEqual(original);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
});

test("mock assessment hides explanations and submits exactly once when its deadline expires", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-17T00:00:00Z") });
  await page.goto("#/stage/1");
  await page.getByRole("radio", { name: "모의평가 모드", exact: true }).check();
  await page.getByLabel("문항 수", { exact: true }).selectOption("5");
  await page
    .getByRole("checkbox", { name: "시간 제한 사용", exact: true })
    .check();
  await page
    .getByRole("button", { name: "모의평가 시작하기", exact: true })
    .click();
  await expect(page.getByRole("radio").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "정답과 해설 보기", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("radio").first().check();
  const session = (await readProgress(page)).activeSession!;
  expect(session.mode).toBe("assessment");
  expect(session.deadlineAt).toBeGreaterThan(session.startedAt);
  expect(session.deadlineAt! - session.startedAt).toBe(25 * 60 * 1_000);
  await page.reload();
  await expect(page.getByRole("radio").first()).toBeChecked();
  expect((await readProgress(page)).activeSession).toEqual(session);

  await page.clock.fastForward(session.deadlineAt! - session.startedAt + 1_000);

  await expect(
    page.getByRole("heading", { name: "평가 결과", exact: true }),
  ).toBeVisible();
  const progress = await readProgress(page);
  expect(progress.activeSession).toBeNull();
  expect(progress.results).toHaveLength(1);
  expect(progress.results[0].unansweredCount).toBe(4);
  expect(progress.results[0].sessionId).toBe(session.sessionId);
  await page.reload();
  await page.clock.fastForward(60_000);
  expect((await readProgress(page)).results).toEqual(progress.results);
});

for (const expireDuringReload of [false, true]) {
  test(`timed assessment expires away from the assessment screen${expireDuringReload ? " after an expired-session reload" : ""}`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-10-17T00:00:00Z") });
    const session = await startAssessment(page, "assessment");
    await page.getByRole("radio").first().check();
    await page
      .getByRole("navigation", { name: "주요 메뉴" })
      .getByRole("link", { name: "대시보드", exact: true })
      .click();
    await expect(page.getByRole("link", { name: /이어서 풀기/ })).toBeVisible();
    if (expireDuringReload) {
      await page.clock.setSystemTime(new Date(session.deadlineAt! + 1_000));
      await page.reload();
    } else {
      await page.clock.fastForward(
        session.deadlineAt! - session.startedAt + 1_000,
      );
    }
    await expect(page.getByRole("link", { name: /이어서 풀기/ })).toHaveCount(
      0,
    );
    const progress = await readProgress(page);
    expect(progress.activeSession).toBeNull();
    expect(progress.results).toHaveLength(1);
    expect(progress.results[0]).toMatchObject({
      sessionId: session.sessionId,
      unansweredCount: 4,
    });
    await page.goto(`#/assessment/${session.sessionId}`);
    await expect(
      page.getByRole("heading", { name: "평가 결과", exact: true }),
    ).toBeVisible();
    await page.reload();
    expect((await readProgress(page)).results).toEqual(progress.results);
  });
}

for (const badRecord of [
  "{broken-json",
  '{"version":99,"activeSession":null}',
]) {
  test(`damaged or future-version records are quarantined without blocking the app: ${badRecord}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ storagePrefix, record }) => {
        localStorage.setItem(
          `${storagePrefix}:generation:default:active`,
          record,
        );
        localStorage.setItem(
          `${storagePrefix}:generation:default:bookmarks`,
          JSON.stringify({ version: 1, bookmarks: ["preserved-bookmark"] }),
        );
      },
      { storagePrefix: prefix, record: badRecord },
    );
    await page.goto("./");

    await expect(
      page.getByText(
        /저장된 기록에 손상되었거나 지원하지 않는 버전의 데이터가 있습니다/,
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        (storagePrefix) =>
          JSON.parse(
            localStorage.getItem(
              `${storagePrefix}:generation:default:bookmarks`,
            )!,
          ).bookmarks,
        prefix,
      ),
    ).toEqual(["preserved-bookmark"]);
    expect(
      await page.evaluate((storagePrefix) => {
        const keys = Object.keys(localStorage).filter((key) =>
          key.startsWith(`${storagePrefix}:quarantine:`),
        );
        return keys
          .map((key) => JSON.parse(localStorage.getItem(key)!))
          .some(
            (item: { raw: string }) =>
              item.raw ===
              localStorage.getItem(
                `${storagePrefix}:generation:default:active`,
              ),
          );
      }, prefix),
    ).toBe(true);
    await page.goto("#/stage/1");
    await expect(
      page.getByRole("button", { name: "학습 시작하기", exact: true }),
    ).toBeEnabled();
  });
}

for (const width of [375, 768, 1440]) {
  test(`layout and keyboard answer controls work at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    await expect(page.getByRole("main")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`dashboard-${width}.png`),
      fullPage: true,
    });
    await startAssessment(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const first = page.getByRole("radio").first();
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    await expect(page.getByRole("radio").nth(1)).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`assessment-${width}.png`),
      fullPage: true,
    });
  });
}
