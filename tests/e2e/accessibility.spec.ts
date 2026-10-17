import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("core pages meet automated WCAG AA checks and skip navigation preserves the route", async ({
  page,
}) => {
  async function audit(label: string) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      label,
    ).toEqual([]);
  }
  await page.goto("");
  await audit("dashboard");
  await page.getByRole("link", { name: "본문으로 건너뛰기" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: /AI를 이해하는 힘/ }),
  ).toBeVisible();
  await page.goto("#/stage/1");
  await audit("stage introduction");
  await page.getByRole("combobox", { name: "문항 수" }).selectOption("5");
  await page
    .getByRole("button", { name: "학습 시작하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /AI 지식평가/ }),
  ).toBeVisible();
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "정답과 해설 보기", exact: true })
    .click();
  await audit("learning assessment with explanation");
  await page.getByRole("button", { name: "제출하기", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit("submission dialog");
  await page.getByRole("button", { name: "제출 확정", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "평가 결과", exact: true }),
  ).toBeVisible();
  await page
    .locator(".result-question")
    .first()
    .locator("summary")
    .first()
    .click();
  await audit("results and explanation");
  await page.goto("#/history");
  await audit("history");
  await page.goto("#/review");
  await audit("review");
});
