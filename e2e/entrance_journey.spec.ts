import { test, expect } from "@playwright/test";

// NOTE: These tests assume a running local dev server at localhost:3000
// AND a specific "Entrance Flow" exists.
// For automated CI, we would seed the DB.
// For this verification pass, we assume the user has set up the "Welcome Guide" as per Manual Test plan.

const BASE_URL = "http://localhost:3000";
// Replace with the ACTUAL ID of the flow created during manual testing if known
// or use a known stable URL.
// For now, we'll assume the URL structure is known or we can navigate to it.
const FLOW_URL = `${BASE_URL}/f/YOUR_FORM_ID`;

// Since we don't know the exact Form ID without querying the DB (which failed in integration),
// we will write the test structure but mark it as requiring configuration.

test.describe("Entrance Journey", () => {
  // Skipping because we need dynamic form ID from previous steps or env var
  test.skip("Complete flow and merge profile", async ({ page }) => {
    // 1. Visit Flow
    await page.goto(FLOW_URL);
    await expect(page.getByText("Welcome")).toBeVisible();

    // 2. Answer Questions
    await page.getByRole("button", { name: "Start" }).click();
    await page.getByText("Stressed").click();

    // 3. See Recs
    await expect(page.getByText("Recommended for you")).toBeVisible();
    await expect(page.getByText("Calm Elixir")).toBeVisible();

    // 4. Capture Email
    await page.getByPlaceholder("Email").fill("e2e_test@example.com");
    await page.getByRole("button", { name: "Submit" }).click();

    // 5. Verify Success
    await expect(page.getByText("Thank you")).toBeVisible();
  });
});
