import { test, expect } from "@playwright/test";

// Configuration
const BASE_URL = "http://localhost:3000";

// Credentials - Set these in your environment or hardcode for local testing
const TEST_EMAIL = process.env.TEST_EMAIL || "tanmay@example.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "password";

test.describe("Mirour Full End-to-End Flow", () => {
  test("Full Admin Journey: Login -> Create Store -> Create Flow -> Build", async ({
    page,
  }) => {
    // 1. Login Flow
    await page.goto(BASE_URL);

    // Wait for initial load
    await Promise.race([
      page
        .getByRole("button", { name: "Sign In" })
        .waitFor({ state: "visible" }),
      page.getByText("My Flows").waitFor({ state: "visible" }),
    ]);

    // If not logged in, perform login
    if (await page.getByRole("button", { name: "Sign In" }).isVisible()) {
      console.log(`Logging in as ${TEST_EMAIL}...`);
      await page.getByPlaceholder("you@example.com").fill(TEST_EMAIL);
      await page.getByPlaceholder("••••••••").fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();

      // Wait for network to settle
      try {
        await page
          .waitForLoadState("networkidle", { timeout: 10000 })
          .catch(() => {});
      } catch (e) {}

      // Wait for dashboard or error
      try {
        await expect(
          page.getByRole("button", { name: "My Flows" }),
        ).toBeVisible({
          timeout: 60000,
        });
      } catch (e) {
        console.log(`Login Timeout. URL: ${page.url()}`);
        const bodyText = await page.locator("body").innerText();
        console.log(`Page Text Sample: ${bodyText.slice(0, 300)}`);

        // Check for error message
        const errorText = await page
          .locator(".text-destructive")
          .textContent()
          .catch(() => null);
        if (errorText) {
          throw new Error(`Login Failed with UI Error: ${errorText}`);
        }
        throw e;
      }
    } else {
      console.log("Already logged in.");
    }

    // 2. Create Store
    await page.getByRole("button", { name: "Stores" }).click();

    // Add Store if button visible (might be hidden if limit reached? assuming free tier logic)
    if (await page.getByRole("button", { name: "Add Store" }).isVisible()) {
      await page.getByRole("button", { name: "Add Store" }).click();
    }

    const storeName = `E2E Store ${Date.now()}`;
    // Use Label selector as it's more robust and matches the code
    await page.getByLabel("Store Name").fill(storeName);

    // Button is "Save", not "Create"
    await page.getByRole("button", { name: "Save" }).click();

    // Verify store created
    await expect(page.getByText(storeName)).toBeVisible();

    // 3. Add Products (in Store Detail)
    await page.getByText(storeName).click();
    await page.getByRole("button", { name: "Products" }).click();

    await page.getByRole("button", { name: "Add Product" }).click();
    await page.getByPlaceholder("Product Name").fill("Calm Tea");

    // Create 'calm' tag
    await page.getByText("+ New Tag").click();
    await page.waitForTimeout(200); // Wait for render
    await page.getByPlaceholder("New Tag Name").fill("calm");

    // Use exact text match for the small Add button
    await page.getByText("Add", { exact: true }).click();

    // Select the tag (might need wait for optimistic update or fetch)
    // Providing a small wait or retry capability is good, but Playwright auto-waits for element to appear
    await page.getByRole("button", { name: "calm" }).click();

    await page.getByRole("button", { name: "Save Product" }).click();
    await expect(page.getByText("Calm Tea")).toBeVisible();

    // 4. Create Flow
    // Go back to flows tab
    await page.getByRole("button", { name: "My Flows" }).click();

    await page.getByRole("button", { name: "Create Flow" }).click();

    const flowName = `E2E Flow ${Date.now()}`;
    await page.getByPlaceholder("e.g., Customer Feedback").fill(flowName);

    // Select the store
    await page.locator("select").selectOption({ label: storeName });

    await page.getByRole("button", { name: "Create Flow" }).click();

    // 5. Build Flow
    // Expect to be in builder
    await expect(page.getByPlaceholder("Flow name...")).toHaveValue(flowName);

    // Test Edit
    const welcomeNode = page.getByText("Welcome!").first();
    await expect(welcomeNode).toBeVisible();
    await welcomeNode.click();

    await expect(page.getByText("Edit Step")).toBeVisible();
    await page.getByPlaceholder("Welcome!").fill(`Welcome to ${flowName}`);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
  });
});
