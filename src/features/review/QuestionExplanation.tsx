import { CheckCircle2, Info, XCircle } from "lucide-react";
import type { Question } from "../../domain/types";
export function QuestionExplanation({
  question,
  selected,
  neutral = false,
}: {
  question: Question;
  selected?: string;
  neutral?: boolean;
}) {
  const correct = selected === question.correctOptionId;
  const answer = question.options.find(
    (o) => o.id === question.correctOptionId,
  )!;
  return (
    <div
      className={`explanation ${neutral ? "explanation-neutral" : correct ? "explanation-correct" : ""}`}
    >
      <div className="explanation-status">
        {neutral ? (
          <Info size={19} />
        ) : correct ? (
          <CheckCircle2 size={19} />
        ) : (
          <XCircle size={19} />
        )}
        <strong>
          {neutral
            ? "정답과 해설"
            : correct
              ? "정답이에요!"
              : selected
                ? "다시 살펴볼까요?"
                : "미응답 문항이에요"}
        </strong>
      </div>
      <p>
        <strong>정답</strong> · {answer.text}
      </p>
      <p>{question.explanation}</p>
      {selected && !correct && (
        <p className="wrong-explanation">
          <strong>선택한 답안의 해설</strong>
          <br />
          {question.optionExplanations[selected]}
        </p>
      )}
      <details className="option-explanations">
        <summary>모든 선택지 해설</summary>
        {question.options.map((o) => (
          <div key={o.id}>
            <strong>
              {o.id === question.correctOptionId ? "✓ 정답" : "오답"} · {o.text}
            </strong>
            <p>{question.optionExplanations[o.id]}</p>
          </div>
        ))}
      </details>
      <div className="keyword-tags">
        {question.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
    </div>
  );
}
