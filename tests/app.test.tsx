import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/app/App";
import { progressRepository } from "../src/infrastructure/services";

const dialogPrototype = HTMLDialogElement.prototype;
const originalShowModal = Object.getOwnPropertyDescriptor(
  dialogPrototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(dialogPrototype, "close");

beforeAll(() => {
  // jsdom does not implement the native dialog top layer; browsers exercise it in E2E.
  Object.defineProperty(dialogPrototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(dialogPrototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});

afterAll(() => {
  if (originalShowModal)
    Object.defineProperty(dialogPrototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(dialogPrototype, "showModal");
  if (originalClose)
    Object.defineProperty(dialogPrototype, "close", originalClose);
  else Reflect.deleteProperty(dialogPrototype, "close");
});

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/AI-Literacy-Lab/#/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

describe("AI Literacy Lab user journeys", () => {
  it("offers the working knowledge stage and clearly disables the two future stages", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "AI를 이해하는 힘",
    );
    expect(screen.getByRole("heading", { name: "AI 지식평가" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "AI 활용평가" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "AI 전문평가" })).toBeVisible();
    const futureStages = screen.getAllByRole("button", { name: "준비 중" });
    expect(futureStages).toHaveLength(2);
    futureStages.forEach((button) => expect(button).toBeDisabled());
    expect(progressRepository.load().activeSession).toBeNull();
    await user.click(screen.getByRole("link", { name: "학습 시작" }));
    expect(screen.getByRole("region", { name: "평가 설정" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "학습 모드" })).toBeChecked();
  });

  it("starts a filtered learning session and resumes saved answers, position, and option order after remount", async () => {
    const user = userEvent.setup();
    const firstMount = render(<App />);
    await user.click(screen.getByRole("link", { name: "학습 시작" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "출제 영역" }),
      "fundamentals",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "난이도" }),
      "beginner",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "문항 수" }),
      "5",
    );
    await user.click(screen.getByRole("button", { name: "학습 시작하기" }));

    const questionPanel = await screen.findByRole("region", {
      name: "현재 문제",
    });
    const started = progressRepository.load().activeSession!;
    expect(started.mode).toBe("learning");
    expect(started.deadlineAt).toBeNull();
    expect(started.questions.length).toBeGreaterThan(1);
    expect(
      started.questions.every(
        (question) =>
          question.category === "fundamentals" &&
          question.difficulty === "beginner",
      ),
    ).toBe(true);
    const firstQuestion = started.questions[0];
    const firstOptionId = started.displayedOptionOrder[firstQuestion.id][0];
    await user.click(within(questionPanel).getAllByRole("radio")[0]);
    expect(
      progressRepository.load().activeSession?.answers[firstQuestion.id],
    ).toBe(firstOptionId);
    await user.click(screen.getByRole("button", { name: "다음 문제" }));
    expect(progressRepository.load().activeSession?.currentIndex).toBe(1);

    firstMount.unmount();
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: started.questions[1].stem }),
    ).toBeVisible();
    expect(
      progressRepository.load().activeSession?.displayedOptionOrder,
    ).toEqual(started.displayedOptionOrder);
    await user.click(screen.getByRole("button", { name: "이전 문제" }));
    expect(
      screen.getByRole("heading", { name: firstQuestion.stem }),
    ).toBeVisible();
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
    await user.click(screen.getByRole("button", { name: "정답과 해설 보기" }));
    expect(screen.getByText(firstQuestion.explanation)).toBeVisible();
    screen
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).toBeDisabled());
    expect(
      progressRepository.load().activeSession?.revealedQuestionIds,
    ).toContain(firstQuestion.id);
  });

  it("keeps assessment explanations hidden, confirms unanswered questions, and saves one immutable result", async () => {
    const user = userEvent.setup();
    const mounted = render(<App />);
    await user.click(screen.getByRole("link", { name: "학습 시작" }));
    await user.click(screen.getByRole("radio", { name: "모의평가 모드" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "문항 수" }),
      "5",
    );
    await user.click(screen.getByRole("checkbox", { name: "시간 제한 사용" }));
    await user.click(screen.getByRole("button", { name: "모의평가 시작하기" }));
    await screen.findByRole("region", { name: "현재 문제" });
    const started = progressRepository.load().activeSession!;
    const firstQuestion = started.questions[0];
    const correctOption = firstQuestion.options.find(
      (option) => option.id === firstQuestion.correctOptionId,
    )!;
    expect(
      screen.queryByRole("button", { name: "정답과 해설 보기" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(firstQuestion.explanation),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("radio", {
        name: (name) => name.endsWith(correctOption.text),
      }),
    );
    expect(
      screen.queryByText(firstQuestion.explanation),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다음 문제" }));
    const secondQuestion = started.questions[1];
    const wrongOption = secondQuestion.options.find(
      (option) => option.id !== secondQuestion.correctOptionId,
    )!;
    await user.click(
      screen.getByRole("radio", {
        name: (name) => name.endsWith(wrongOption.text),
      }),
    );

    await user.click(screen.getByRole("button", { name: "제출하기" }));
    const firstDialog = screen.getByRole("dialog", {
      name: "평가를 제출할까요?",
    });
    expect(within(firstDialog).getByText("미응답 3문항")).toBeVisible();
    expect(progressRepository.load().results).toHaveLength(0);
    await user.click(within(firstDialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(progressRepository.load().activeSession?.sessionId).toBe(
      started.sessionId,
    );
    await user.click(screen.getByRole("button", { name: "제출하기" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "제출 확정",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "평가 결과" }),
    ).toBeVisible();
    expect(screen.getByText("총점 / 100").parentElement).toHaveTextContent(
      "20점",
    );
    const saved = progressRepository.load();
    expect(saved.activeSession).toBeNull();
    expect(saved.results).toHaveLength(1);
    expect(saved.results[0]).toMatchObject({
      correctCount: 1,
      incorrectCount: 1,
      unansweredCount: 3,
      totalQuestions: 5,
      score: 20,
    });

    mounted.unmount();
    window.history.replaceState(
      null,
      "",
      `/AI-Literacy-Lab/#/assessment/${started.sessionId}`,
    );
    render(<App />);
    await waitFor(() =>
      expect(
      screen.getByRole("heading", { name: "평가 결과" }),
      ).toBeVisible(),
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(progressRepository.load().results).toEqual(saved.results);
  });
});
