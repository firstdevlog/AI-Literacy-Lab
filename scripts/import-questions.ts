import path from "node:path";
import { importQuestionFile } from "./question-files";

try {
  const files = process.argv.slice(2);
  if (files.length !== 1)
    throw new Error(
      "사용법: npm run questions:import -- <문제파일.json|.jsonl|.md>",
    );
  const sourcePath = path.resolve(files[0]);
  const { destination, count } = await importQuestionFile(sourcePath);
  console.log(
    `문항 ${count}개를 가져왔습니다: ${path.relative(process.cwd(), destination)}`,
  );
  console.log(
    '검토 중(status: "review")인 문항은 검증 가능하지만 정식 출제에서 제외됩니다.',
  );
} catch (error) {
  const message =
    error instanceof Error ? error.message : "문항을 가져오지 못했습니다.";
  console.error(message);
  process.exitCode = 1;
}
