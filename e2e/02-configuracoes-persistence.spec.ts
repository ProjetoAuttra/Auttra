import { expect, test, type Page } from "@playwright/test";

// Requires a running backend + seeded user (see .github/workflows/ci.yml, job "e2e-smoke",
// or run `npm run seed:admin` in Back/ locally with matching env vars).
const email = process.env.E2E_ADMIN_EMAIL ?? "";
const password = process.env.E2E_ADMIN_PASSWORD ?? "";

test.skip(!email || !password, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not configured");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function openSection(page: Page, sectionKey: string) {
  await page.goto("/configuracoes");
  await page.getByTestId(`header-${sectionKey}`).click();
  return page.getByTestId(`section-${sectionKey}`);
}

test.describe("Configuracoes - Agenda e Financeiro persistem de verdade", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("altera uma configuracao de Agenda, recarrega e confirma que persistiu", async ({ page }) => {
    const section = await openSection(page, "agenda");
    await section.getByTestId("edit-agenda").click();

    const tempoMedioField = page.getByLabel("Tempo médio por serviço");
    await tempoMedioField.fill("75 minutos");
    await section.getByTestId("save-agenda").click();

    await expect(page.getByText("Configuracoes de agenda salvas.")).toBeVisible();

    await page.reload();
    const reloadedSection = await openSection(page, "agenda");
    await expect(reloadedSection.getByTestId("content-agenda")).toContainText("75 minutos");
  });

  test("altera uma configuracao de Financeiro, recarrega e confirma que persistiu", async ({ page }) => {
    const section = await openSection(page, "financeiro");
    await section.getByTestId("edit-financeiro").click();

    const jurosField = page.getByLabel("Juros por atraso");
    await jurosField.fill("7%");
    await section.getByTestId("save-financeiro").click();

    await expect(page.getByText("Configuracoes financeiras salvas.")).toBeVisible();

    await page.reload();
    const reloadedSection = await openSection(page, "financeiro");
    await expect(reloadedSection.getByTestId("content-financeiro")).toContainText("7%");
  });
});
