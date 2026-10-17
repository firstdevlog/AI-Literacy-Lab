import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, evaluateSession } from "../domain";
import type { AssessmentSession, Question } from "../domain/types";
import { createProgressRepository, STORAGE_PREFIX } from "./progressRepository";

const question: Question = {
  id: "fixture-001",
  stage: 1,
  type: "single_choice",
  category: "fundamentals",
  difficulty: "beginner",
  stem: "AI가 생성한 정보는 어떻게 확인해야 할까요?",
  options: [
    { id: "verify", text: "신뢰할 수 있는 근거로 검증한다." },
    { id: "trust", text: "항상 정확하므로 그대로 사용한다." },
  ],
  correctOptionId: "verify",
  explanation: "AI의 출력은 출처와 근거를 검증해야 합니다.",
  optionExplanations: {
    verify: "출처 확인으로 오류를 줄일 수 있습니다.",
    trust: "AI는 잘못된 정보를 생성할 수 있습니다.",
  },
  tags: ["검증"],
  provenance: "original",
  version: 1,
  status: "published",
};

function session(id = "session-1", correct = true): AssessmentSession {
  const created = createSession(
    [question],
    { mode: "assessment", count: 1 },
    1_000,
    () => 0.3,
  );
  return {
    ...created,
    sessionId: id,
    answers: { [question.id]: correct ? "verify" : "trust" },
  };
}

function repository(storage: Storage | null = localStorage) {
  return createProgressRepository({
    storage,
    now: () => 10_000,
    makeId: () => "fixture",
  });
}

const key = (record: string) =>
  `${STORAGE_PREFIX}:generation:default:${record}`;

beforeEach(() => localStorage.clear());

describe("browser progress repository", () => {
  it("restores the full active snapshot and stable option order from a new repository instance", () => {
    const saved = session();
    const repo = repository();
    repo.saveActive(saved);
    repo.toggleBookmark(question.id);
    expect(repository().load()).toEqual({
      version: 1,
      activeSession: saved,
      results: [],
      bookmarks: [question.id],
    });
    saved.questions[0].stem = "changed outside storage";
    expect(repository().load().activeSession?.questions[0].stem).toBe(
      question.stem,
    );
  });

  it("keeps the first submitted result immutable and rejects stale active-session autosaves", () => {
    const repo = repository();
    const active = session();
    repo.saveActive(active);
    const first = evaluateSession(active, 5_000);
    repo.saveResult(first);
    const later = evaluateSession(
      { ...active, answers: { [question.id]: "trust" } },
      9_000,
    );
    expect(repo.saveResult(later)).toEqual(first);
    expect(repo.load().results).toEqual([first]);
    expect(repo.load().activeSession).toBeNull();
    expect(() => repo.saveActive(active)).toThrow("이미 제출된 평가");
    expect(() => {
      repo.load().results[0].score = 0;
    }).not.toThrow();
    expect(repo.load().results[0].score).toBe(100);
  });

  it("uses fresh records for sequential changes in different tabs", () => {
    const firstTab = repository();
    const secondTab = repository();
    firstTab.toggleBookmark("one");
    secondTab.toggleBookmark("two");
    firstTab.toggleBookmark("one");
    firstTab.saveResult(evaluateSession(session("first"), 2_000));
    secondTab.saveResult(evaluateSession(session("second"), 3_000));
    expect(secondTab.load().bookmarks).toEqual(["two"]);
    expect(firstTab.load().results.map((result) => result.sessionId)).toEqual([
      "first",
      "second",
    ]);
  });

  it("does not clear a different active session when an older session is submitted", () => {
    const repo = repository();
    const active = session("current");
    repo.saveActive(active);
    repo.saveResult(evaluateSession(session("older"), 3_000));
    expect(repo.load().activeSession).toEqual(active);
  });

  it("reconciles and removes an interrupted submission active record on duplicate submit", () => {
    const repo = repository();
    const active = session();
    const result = evaluateSession(active, 3_000);
    repo.saveResult(result);
    localStorage.setItem(
      key("active"),
      JSON.stringify({ version: 1, activeSession: active }),
    );
    expect(repo.load().activeSession).toBeNull();
    expect(repo.saveResult(result)).toEqual(result);
    expect(
      JSON.parse(localStorage.getItem(key("active"))!).activeSession,
    ).toBeNull();
  });

  it("quarantines malformed JSON without crashing or losing unrelated bookmarks", () => {
    const damaged = "{broken";
    localStorage.setItem(key("active"), damaged);
    localStorage.setItem(
      key("bookmarks"),
      JSON.stringify({ version: 1, bookmarks: ["keep"] }),
    );
    const repo = repository();
    expect(repo.load()).toEqual({
      version: 1,
      activeSession: null,
      results: [],
      bookmarks: ["keep"],
    });
    expect(repo.getWarning()).toMatch(/손상/);
    const quarantineKeys = Object.keys(localStorage).filter((item) =>
      item.includes(":quarantine:"),
    );
    expect(quarantineKeys).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(quarantineKeys[0])!).raw).toBe(
      damaged,
    );
    repo.load();
    expect(
      Object.keys(localStorage).filter((item) => item.includes(":quarantine:")),
    ).toHaveLength(1);
  });

  it("handles unknown stored versions and semantically invalid option orders safely", () => {
    localStorage.setItem(
      key("results"),
      JSON.stringify({ version: 2, results: [] }),
    );
    const invalid = session();
    invalid.displayedOptionOrder[question.id] = ["verify", "verify"];
    localStorage.setItem(
      key("active"),
      JSON.stringify({ version: 1, activeSession: invalid }),
    );
    const repo = repository();
    expect(repo.load().activeSession).toBeNull();
    expect(repo.load().results).toEqual([]);
    expect(repo.getWarning()).toMatch(/지원하지 않는 버전/);
    expect(
      Object.keys(localStorage).filter((item) => item.includes(":quarantine:")),
    ).toHaveLength(2);
  });

  it("uses memory with a clear warning when browser storage is unavailable", () => {
    const repo = repository(null);
    repo.saveActive(session());
    repo.toggleBookmark("keep");
    expect(repo.load().activeSession?.sessionId).toBe("session-1");
    expect(repo.load().bookmarks).toEqual(["keep"]);
    expect(repo.getWarning()).toMatch(/메모리/);
    expect(repository(null).load().activeSession).toBeNull();
  });

  it("retains already-read data in memory if storage writes fail", () => {
    const repo = repository();
    repo.saveActive(session());
    repo.toggleBookmark("old");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    repo.toggleBookmark("new");
    expect(repo.load().bookmarks).toEqual(["old", "new"]);
    expect(repo.load().activeSession?.sessionId).toBe("session-1");
    expect(repo.getWarning()).toMatch(/메모리/);
  });

  it("exports and atomically replaces all progress with a validated version 1 backup", () => {
    const source = repository(null);
    source.saveResult(evaluateSession(session("completed"), 5_000));
    source.saveActive(session("active"));
    source.toggleBookmark("imported");
    const target = repository();
    target.toggleBookmark("replaced");
    target.importData(source.exportData());
    expect(target.load()).toEqual(source.load());
    expect(repository().load()).toEqual(source.load());
    expect(
      JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}:head`)!).generation,
    ).toMatch(/^import-/);
  });

  it("uses a new import generation even when clocks and ID generators repeat", () => {
    const firstBackup = JSON.stringify({
      version: 1,
      activeSession: null,
      results: [],
      bookmarks: ["first"],
    });
    const secondBackup = JSON.stringify({
      version: 1,
      activeSession: null,
      results: [],
      bookmarks: ["second"],
    });
    repository().importData(firstBackup);
    const firstHead = localStorage.getItem(`${STORAGE_PREFIX}:head`);
    repository().importData(secondBackup);
    expect(localStorage.getItem(`${STORAGE_PREFIX}:head`)).not.toBe(firstHead);
    expect(repository().load().bookmarks).toEqual(["second"]);
  });

  it("keeps the durable snapshot intact if staging an import exceeds browser quota", () => {
    const repo = repository();
    repo.toggleBookmark("durable-original");
    const originalSetItem = Storage.prototype.setItem;
    const writer = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, recordKey, value) {
        if (recordKey.includes("import-") && recordKey.endsWith(":results"))
          throw new DOMException("Full", "QuotaExceededError");
        return originalSetItem.call(this, recordKey, value);
      });
    repo.importData(
      JSON.stringify({
        version: 1,
        activeSession: null,
        results: [],
        bookmarks: ["memory-import"],
      }),
    );
    expect(repo.load().bookmarks).toEqual(["memory-import"]);
    expect(repo.getWarning()).toMatch(/메모리/);
    writer.mockRestore();
    expect(repository().load().bookmarks).toEqual(["durable-original"]);
  });

  it.each([
    ["malformed JSON", "{bad"],
    [
      "unsupported version",
      JSON.stringify({
        version: 2,
        activeSession: null,
        results: [],
        bookmarks: [],
      }),
    ],
    [
      "duplicate bookmarks",
      JSON.stringify({
        version: 1,
        activeSession: null,
        results: [],
        bookmarks: ["same", "same"],
      }),
    ],
  ])("rejects %s backups without changing any storage", (_name, json) => {
    const repo = repository();
    repo.saveActive(session("preserved"));
    repo.toggleBookmark("preserved");
    const before = { ...localStorage };
    expect(() => repo.importData(json)).toThrow(
      "기존 기록은 변경되지 않았습니다",
    );
    expect({ ...localStorage }).toEqual(before);
  });

  it("rejects forged scoring, duplicate result IDs, and completed-active conflicts before import writes", () => {
    const result = evaluateSession(session(), 3_000);
    const invalidBackups = [
      {
        version: 1,
        activeSession: null,
        results: [{ ...result, score: 0 }],
        bookmarks: [],
      },
      {
        version: 1,
        activeSession: null,
        results: [result, result],
        bookmarks: [],
      },
      {
        version: 1,
        activeSession: session(),
        results: [result],
        bookmarks: [],
      },
    ];
    const repo = repository();
    repo.toggleBookmark("preserved");
    const before = { ...localStorage };
    invalidBackups.forEach((backup) =>
      expect(() => repo.importData(JSON.stringify(backup))).toThrow(),
    );
    expect({ ...localStorage }).toEqual(before);
  });
});
