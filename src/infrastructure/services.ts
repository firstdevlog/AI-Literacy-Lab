import {
  createSession,
  evaluateSession,
  summarizeResults,
  validateQuestionBank,
} from "../domain";
import type {
  AssessmentService,
  EvaluationService,
  LearningAnalyticsService,
  Question,
  QuestionRepository,
} from "../domain/types";
import { createProgressRepository } from "./progressRepository";

const modules = import.meta.glob("../data/questions/*.json", {
  eager: true,
  import: "default",
});

function immutableQuestion(question: Question): Question {
  question.options.forEach((option) => Object.freeze(option));
  Object.freeze(question.options);
  Object.freeze(question.optionExplanations);
  Object.freeze(question.tags);
  return Object.freeze(question);
}

let bank: readonly Question[] | null = null;

function getQuestions(): readonly Question[] {
  if (!bank) {
    const parsed = validateQuestionBank(
      Object.values(modules).flatMap((value) =>
        Array.isArray(value) ? value : [value],
      ),
    );
    bank = Object.freeze(parsed.map(immutableQuestion));
  }
  return bank;
}

export const questionRepository: QuestionRepository = {
  getAll: () => [...getQuestions()],
  getByIds: (ids) => {
    const byId = new Map(
      getQuestions().map((question) => [question.id, question]),
    );
    return [...new Set(ids)].flatMap((id) => {
      const question = byId.get(id);
      return question ? [question] : [];
    });
  },
};

export const assessmentService: AssessmentService = {
  create: (config, now) =>
    createSession(questionRepository.getAll(), config, now),
};

export const evaluationService: EvaluationService = {
  evaluate: (session, now) => evaluateSession(session, now),
};

export const learningAnalyticsService: LearningAnalyticsService = {
  summarize: (results) => summarizeResults(results),
};

export const progressRepository = createProgressRepository();
