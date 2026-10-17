import { CATEGORY_LABELS } from "../src/domain/types";
import { readQuestionFiles } from "./question-files";

try {
  const questions = await readQuestionFiles();
  if (questions.length === 0) throw new Error("문제은행이 비어 있습니다.");
  const published = questions.filter(
    (question) => question.status === "published",
  );
  console.log(
    `문제 데이터 검증 완료: 전체 ${questions.length}문항, 출제 가능 ${published.length}문항, 검토 중 ${questions.length - published.length}문항`,
  );
  for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
    console.log(
      `  ${label}: ${questions.filter((question) => question.category === category).length}문항`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "문제 데이터 검증에 실패했습니다.",
  );
  process.exitCode = 1;
}
