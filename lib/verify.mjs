import assert from "node:assert/strict";
export async function verifyCanvas({ browser, address, project }) {
  const page = await browser.newPage({
    viewport: { width: 1512, height: 982 },
  });
  try {
    await page.goto(address);
    await page
      .getByText(`${project.catalog.length} 個畫面 · 已同步`, { exact: true })
      .waitFor();
    await page.waitForFunction(
      (count) => document.querySelectorAll(".screen-frame").length === count,
      project.catalog.length,
    );
    assert.equal(
      await page.locator("iframe").count(),
      0,
      "overview must use bounded snapshots",
    );
    assert.equal(await page.locator(".render-error").count(), 0);
    await page
      .getByRole("button", { name: "▶ 操作 App", exact: true })
      .click();
    const frame = page.frameLocator("iframe");
    await frame.locator("html[data-review-ready=true]").waitFor();
    assert.equal(
      await page.locator("iframe").count(),
      1,
      "only one live app is mounted",
    );
    await page.getByLabel("預覽狀態").selectOption(project.catalog.at(-1).id);
    await frame.locator("html[data-review-ready=true]").waitFor();
    await page.getByRole("button", { name: /返回畫布/ }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "desktop canvas overflow",
    );
  } finally {
    await page.close();
  }
}
