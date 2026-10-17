import { z } from "zod";
import { assessmentSessionSchema, evaluationResultSchema } from "../domain";
import type {
  AssessmentSession,
  EvaluationResult,
  ProgressData,
  ProgressRepository,
} from "../domain/types";

export const STORAGE_PREFIX = "ai-literacy-lab:v1";

const bookmarkSchema = z.string().min(1).max(200);
const resultsSchema = z
  .array(evaluationResultSchema)
  .max(10_000)
  .superRefine((results, ctx) => {
    const ids = new Set<string>();
    results.forEach((result, index) => {
      if (ids.has(result.sessionId))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "sessionId"],
          message: "평가 결과의 세션 ID가 중복되었습니다.",
        });
      ids.add(result.sessionId);
    });
  });
const bookmarksSchema = z
  .array(bookmarkSchema)
  .max(10_000)
  .superRefine((bookmarks, ctx) => {
    if (new Set(bookmarks).size !== bookmarks.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "북마크 ID가 중복되었습니다.",
      });
  });

/** All backup records are checked before a replacement becomes visible. */
export const progressDataSchema = z
  .object({
    version: z.literal(1),
    activeSession: assessmentSessionSchema.nullable(),
    results: resultsSchema,
    bookmarks: bookmarksSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.activeSession &&
      data.results.some(
        (result) => result.sessionId === data.activeSession?.sessionId,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["activeSession"],
        message: "제출된 세션을 진행 중인 세션으로 가져올 수 없습니다.",
      });
    }
  });

const headSchema = z
  .object({
    version: z.literal(1),
    generation: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
  })
  .strict();
const activeRecordSchema = z
  .object({
    version: z.literal(1),
    activeSession: assessmentSessionSchema.nullable(),
  })
  .strict();
const resultsRecordSchema = z
  .object({ version: z.literal(1), results: resultsSchema })
  .strict();
const bookmarksRecordSchema = z
  .object({ version: z.literal(1), bookmarks: bookmarksSchema })
  .strict();

export interface ProgressRepositoryOptions {
  /** Omit to use window.localStorage. Explicit null selects the memory adapter. */
  storage?: Storage | null;
  keyPrefix?: string;
  now?: () => number;
  makeId?: () => string;
}

class StorageDriver {
  private storage: Storage | null;
  private readonly memory = new Map<string, string>();

  constructor(
    storage: Storage | null,
    private readonly warn: (warning: string) => void,
  ) {
    this.storage = storage;
    if (!storage) this.warnMemory();
  }

  private warnMemory() {
    this.warn(
      "브라우저 저장소를 사용할 수 없어 현재 탭의 메모리에 저장합니다. 탭을 닫거나 새로고침하면 진행 기록이 사라질 수 있습니다. 백업을 내보내 보관하세요.",
    );
  }

  read(key: string): string | null {
    if (this.storage) {
      try {
        const raw = this.storage.getItem(key);
        if (raw === null) this.memory.delete(key);
        else this.memory.set(key, raw);
        return raw;
      } catch {
        this.storage = null;
        this.warnMemory();
      }
    }
    return this.memory.get(key) ?? null;
  }

  write(key: string, raw: string): void {
    if (this.storage) {
      try {
        this.storage.setItem(key, raw);
      } catch {
        this.storage = null;
        this.warnMemory();
      }
    }
    this.memory.set(key, raw);
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

class BrowserProgressRepository implements ProgressRepository {
  private readonly driver: StorageDriver;
  private readonly warnings = new Set<string>();
  private readonly quarantined = new Set<string>();
  private readonly prefix: string;
  private readonly now: () => number;
  private readonly makeId: () => string;
  private sequence = 0;

  constructor(options: ProgressRepositoryOptions) {
    this.prefix = options.keyPrefix ?? STORAGE_PREFIX;
    this.now = options.now ?? Date.now;
    this.makeId = options.makeId ?? newId;
    this.driver = new StorageDriver(
      options.storage === undefined ? browserStorage() : options.storage,
      (warning) => this.warnings.add(warning),
    );
  }

  getWarning(): string | null {
    return this.warnings.size ? [...this.warnings].join("\n") : null;
  }

  private preserveDamaged(key: string, raw: string): void {
    const fingerprint = `${key}\n${raw}`;
    if (!this.quarantined.has(fingerprint)) {
      this.quarantined.add(fingerprint);
      const stem = `${this.prefix}:quarantine:${this.now()}:${this.makeId()}`;
      let recoveryKey: string;
      do {
        recoveryKey = `${stem}:${this.sequence++}`;
      } while (this.driver.read(recoveryKey) !== null);
      this.driver.write(
        recoveryKey,
        JSON.stringify({ key, raw, savedAt: this.now() }),
      );
    }
    this.warnings.add(
      "저장된 기록에 손상되었거나 지원하지 않는 버전의 데이터가 있습니다. 해당 기록을 건너뛰고 원본을 복구용으로 보관했습니다. 올바른 백업 파일을 가져와 복구할 수 있습니다.",
    );
  }

  private read<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
    const raw = this.driver.read(key);
    if (raw === null) return fallback;
    try {
      return schema.parse(JSON.parse(raw));
    } catch {
      this.preserveDamaged(key, raw);
      return fallback;
    }
  }

  private generation(): string {
    return this.read(`${this.prefix}:head`, headSchema, {
      version: 1,
      generation: "default",
    }).generation;
  }

  private key(
    generation: string,
    record: "active" | "results" | "bookmarks",
  ): string {
    return `${this.prefix}:generation:${generation}:${record}`;
  }

  private write(
    generation: string,
    record: "active" | "results" | "bookmarks",
    data: unknown,
  ): void {
    this.driver.write(this.key(generation, record), JSON.stringify(data));
  }

  private snapshot(): {
    generation: string;
    data: ProgressData;
    storedActiveSession: AssessmentSession | null;
  } {
    const generation = this.generation();
    const active = this.read(
      this.key(generation, "active"),
      activeRecordSchema,
      { version: 1, activeSession: null },
    );
    const completed = this.read(
      this.key(generation, "results"),
      resultsRecordSchema,
      { version: 1, results: [] },
    );
    const bookmarks = this.read(
      this.key(generation, "bookmarks"),
      bookmarksRecordSchema,
      { version: 1, bookmarks: [] },
    );
    // A tab or process can stop after saving a result but before removing its active record.
    const activeSession =
      active.activeSession &&
      !completed.results.some(
        (result) => result.sessionId === active.activeSession?.sessionId,
      )
        ? active.activeSession
        : null;
    return {
      generation,
      data: {
        version: 1,
        activeSession,
        results: completed.results,
        bookmarks: bookmarks.bookmarks,
      },
      storedActiveSession: active.activeSession,
    };
  }

  load(): ProgressData {
    return this.snapshot().data;
  }

  saveActive(session: AssessmentSession | null): void {
    const parsed = assessmentSessionSchema.nullable().parse(session);
    const { generation, data } = this.snapshot();
    if (
      parsed &&
      data.results.some((result) => result.sessionId === parsed.sessionId)
    ) {
      throw new Error("이미 제출된 평가입니다. 결과 화면에서 확인해 주세요.");
    }
    this.write(generation, "active", { version: 1, activeSession: parsed });
  }

  saveResult(result: EvaluationResult): EvaluationResult {
    const parsed = evaluationResultSchema.parse(result);
    const { generation, data, storedActiveSession } = this.snapshot();
    const existing = data.results.find(
      (saved) => saved.sessionId === parsed.sessionId,
    );
    if (!existing)
      this.write(generation, "results", {
        version: 1,
        results: resultsSchema.parse([...data.results, parsed]),
      });
    if (storedActiveSession?.sessionId === parsed.sessionId)
      this.write(generation, "active", { version: 1, activeSession: null });
    return deepFreeze(existing ?? parsed);
  }

  toggleBookmark(id: string): void {
    const parsed = bookmarkSchema.parse(id);
    const { generation, data } = this.snapshot();
    const bookmarks = data.bookmarks.includes(parsed)
      ? data.bookmarks.filter((bookmark) => bookmark !== parsed)
      : [...data.bookmarks, parsed];
    this.write(generation, "bookmarks", {
      version: 1,
      bookmarks: bookmarksSchema.parse(bookmarks),
    });
  }

  exportData(): string {
    return JSON.stringify(this.load(), null, 2);
  }

  importData(json: string): void {
    let data: ProgressData;
    try {
      data = progressDataSchema.parse(JSON.parse(json));
    } catch {
      throw new Error(
        "백업 파일이 손상되었거나 지원하지 않는 형식입니다. 버전 1의 올바른 AI Literacy Lab 백업을 선택해 주세요. 기존 기록은 변경되지 않았습니다.",
      );
    }
    // The head changes only after every new record has been staged. Invalid backups never write.
    const stem = `import-${this.now()}-${this.makeId()}`;
    let generation: string;
    do {
      generation = `${stem}-${this.sequence++}`;
    } while (this.driver.read(this.key(generation, "active")) !== null);
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(generation))
      throw new Error("백업 저장 공간을 만들 수 없습니다.");
    this.write(generation, "active", {
      version: 1,
      activeSession: data.activeSession,
    });
    this.write(generation, "results", { version: 1, results: data.results });
    this.write(generation, "bookmarks", {
      version: 1,
      bookmarks: data.bookmarks,
    });
    this.driver.write(
      `${this.prefix}:head`,
      JSON.stringify({ version: 1, generation }),
    );
  }
}

export function createProgressRepository(
  options: ProgressRepositoryOptions = {},
): ProgressRepository {
  return new BrowserProgressRepository(options);
}
