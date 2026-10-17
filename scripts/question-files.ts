import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateQuestionBank } from "../src/domain/index";
import type { Question } from "../src/domain/types";

export const questionDirectory = fileURLToPath(
  new URL("../src/data/questions/", import.meta.url),
);

function parseJSON(source: string, label: string): unknown {
  try {
    return JSON.parse(source.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    throw new Error(
      `${label}: JSON 형식이 올바르지 않습니다. 쉼표와 따옴표를 확인하세요.`,
    );
  }
}

/** Markdown imports intentionally accept explicit JSON fences, never executable code. */
export function parseQuestionImport(
  source: string,
  extension: string,
): Question[] {
  let data: unknown;
  switch (extension.toLowerCase()) {
    case ".json":
      data = parseJSON(source, "JSON 파일");
      break;
    case ".jsonl":
      data = source
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .flatMap((line, index) =>
          line.trim() ? [parseJSON(line, `JSONL ${index + 1}번째 줄`)] : [],
        );
      break;
    case ".md": {
      const blocks = [...source.matchAll(/```json\s*\r?\n([\s\S]*?)```/gi)];
      if (blocks.length === 0)
        throw new Error(
          "Markdown에는 문제 배열이 담긴 ```json 코드 블록이 필요합니다.",
        );
      data = blocks.flatMap((block, index) => {
        const value = parseJSON(
          block[1],
          `Markdown ${index + 1}번째 JSON 블록`,
        );
        if (!Array.isArray(value))
          throw new Error(
            "Markdown의 JSON 코드 블록에는 문제 배열을 입력하세요.",
          );
        return value as unknown[];
      });
      break;
    }
    default:
      throw new Error("지원하는 확장자는 .json, .jsonl, .md입니다.");
  }
  const questions = validateQuestionBank(data);
  if (questions.length === 0)
    throw new Error("가져올 문제 데이터가 비어 있습니다.");
  return questions;
}

export function safeImportBasename(file: string) {
  const basename = path
    .basename(file, path.extname(file))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 80);
  return `${basename || "imported-questions"}.json`;
}

export async function readQuestionFiles(
  directory = questionDirectory,
): Promise<Question[]> {
  const files = (await readdir(directory))
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort();
  const questions: Question[] = [];
  for (const file of files) {
    const source = await readFile(path.join(directory, file), "utf8");
    try {
      questions.push(...validateQuestionBank(parseJSON(source, file)));
    } catch (error) {
      throw new Error(
        `${file}: ${error instanceof Error ? error.message : "문제 파일을 읽지 못했습니다."}`,
      );
    }
  }
  return validateQuestionBank(questions);
}

export async function importQuestionFile(
  sourcePath: string,
  directory = questionDirectory,
) {
  const source = await readFile(sourcePath, "utf8");
  const imported = parseQuestionImport(source, path.extname(sourcePath));
  await mkdir(directory, { recursive: true });
  const existing = await readQuestionFiles(directory);
  validateQuestionBank([...existing, ...imported]);
  const destination = path.join(directory, safeImportBasename(sourcePath));
  // Exclusive creation preserves every existing bank file even under concurrent imports.
  try {
    await writeFile(destination, `${JSON.stringify(imported, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "EEXIST"
    )
      throw new Error(
        "같은 이름의 문제 파일이 이미 있습니다. 원본 파일 이름을 바꾸어 다시 시도하세요.",
      );
    throw error;
  }
  return { destination, count: imported.length };
}
