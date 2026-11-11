// Small steps shared by the browser tests.

/** Put a hot Latte in the order from the Menu. A quick "+" on a drink that needs hot or iced opens its screen, so this chooses Hot and adds it. */
export async function addLatte(page) {
  await page.getByRole("button", { name: "Choose options for Latte", exact: true }).first().click();
  await page.getByRole("button", { name: "Hot", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Add Latte to order", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: /^Add one more Latte$/ }).first().waitFor({ timeout: 8000 });   // back on the Menu with it in the order
}
