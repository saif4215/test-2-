// Sizes and priced choices on the menu: what is accepted, what is refused, and how the price adds up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOptionGroups, normalizeSizes, priceChoice, ChoiceError, priceLabel, choicesLines } from "./lib/options.mjs";
import { normalizeMenu, publicMenu, checkoutIndex } from "./lib/menu.mjs";

const MILK = { label: "Milk", kind: "one", choices: [{ name: "Oat milk", cents: 100 }, { name: "Almond milk", cents: 100 }] };
const menuWith = (item, optionGroups = { milk: MILK }) => ({ currency: "USD", optionGroups, groups: { Drinks: { Coffee: [item] } } });

test("choices are cleaned: names, prices, kind, and nothing twice", () => {
  const { groups, errors } = normalizeOptionGroups({
    milk: { label: "  Alternative   milk ", choices: [{ name: "Oat milk", cents: 100 }, { name: "oat MILK", cents: 100 }, { name: "Soy", cents: -5 }, { name: "", cents: 1 }, { name: "Free" }] },
    syrup: { label: "Syrup", kind: "many", max: 99, choices: [{ name: "Vanilla", cents: 50 }, { name: "Caramel", cents: 50 }] },
    "Bad Id!": { label: "x", choices: [{ name: "a" }] },
    empty: { label: "Empty", choices: [] },
  });
  assert.equal(groups.milk.label, "Alternative milk");
  assert.deepEqual(groups.milk.choices, [{ name: "Oat milk", cents: 100 }, { name: "Free", cents: 0 }]);
  assert.equal(groups.syrup.max, 2, "a limit above the number of choices is capped");
  assert.ok(!groups["Bad Id!"] && !groups.empty);
  assert.ok(errors.some((e) => /listed twice/.test(e)) && errors.some((e) => /needs a price/.test(e)) && errors.some((e) => /no name/.test(e)) && errors.some((e) => /no choices/.test(e)) && errors.some((e) => /invalid name/.test(e)));
});

test("sizes need a name and a price each, once", () => {
  assert.deepEqual(normalizeSizes([{ name: "Small", cents: 300 }, { name: "Large", cents: 350 }], "Drip").sizes, [{ name: "Small", cents: 300 }, { name: "Large", cents: 350 }]);
  assert.equal(normalizeSizes(undefined, "x").sizes, null);
  assert.ok(normalizeSizes([{ name: "Small", cents: 300 }, { name: "small", cents: 400 }], "Drip").errors.length);
  assert.ok(normalizeSizes([{ name: "Small" }], "Drip").errors.length);
  assert.ok(normalizeSizes([], "Drip").errors.length);
});

test("a menu keeps its sizes and choices; an item's own price follows its first size", () => {
  const { menu, errors } = normalizeMenu(menuWith({ name: "Latte", cents: 1, sizes: [{ name: "Small", cents: 450 }, { name: "Large", cents: 550 }], options: ["milk"] }));
  assert.deepEqual(errors, []);
  const latte = menu.groups.Drinks.Coffee[0];
  assert.equal(latte.cents, 450);
  assert.deepEqual(latte.options, ["milk"]);
  assert.deepEqual(menu.optionGroups.milk.choices.length, 2);
  assert.deepEqual(publicMenu(menu).optionGroups, menu.optionGroups, "customers' phones get the choices too");
  const entry = checkoutIndex(menu).get(latte.id);
  assert.equal(entry.sizes.length, 2);
  assert.equal(entry.groups[0].id, "milk");
});

test("a menu with a choice that does not exist, or a broken size, is refused with a plain message", () => {
  assert.match(normalizeMenu(menuWith({ name: "Latte", cents: 450, options: ["ghost"] })).errors[0], /choices that do not exist \(ghost\)/);
  assert.match(normalizeMenu(menuWith({ name: "Latte", cents: 450, sizes: [{ name: "Small" }] })).errors[0], /size without a name or price/);
  assert.equal(normalizeMenu(menuWith({ name: "Latte", cents: 450 }, undefined)).menu.optionGroups.milk.label, "Milk");
  assert.equal(normalizeMenu({ currency: "USD", groups: { D: { C: [{ name: "x", cents: 100 }] } } }).menu.optionGroups, undefined, "a menu without choices stays as it was");
});

test("the price is the size plus each choice; a bad size or choice is refused", () => {
  const entry = { name: "Latte", cents: 450, sizes: [{ name: "Small", cents: 450 }, { name: "Large", cents: 550 }], groups: [{ id: "milk", ...MILK }, { id: "heat", label: "Heat", kind: "one", required: true, choices: [{ name: "Regular", cents: 0 }, { name: "Hot", cents: 0 }] }] };
  assert.equal(priceChoice(entry).cents, 450);
  assert.equal(priceChoice(entry).text, "Heat: Regular");
  assert.equal(priceChoice(entry, { size: "Large", picks: { milk: ["Oat milk"], heat: ["Hot"] } }).cents, 650);
  assert.equal(priceChoice(entry, { size: "Large", picks: { milk: ["Oat milk"] } }).name, "Latte (Large)");
  assert.notEqual(priceChoice(entry, { size: "Small" }).sig, priceChoice(entry, { size: "Large" }).sig);
  for (const bad of [{ size: "Huge" }, { picks: { milk: ["Oat milk", "Almond milk"] } }, { picks: { milk: ["Soy"] } }, { picks: { nope: ["x"] } }]) assert.throws(() => priceChoice(entry, bad), ChoiceError, JSON.stringify(bad));
  assert.throws(() => priceChoice({ name: "Bagel", cents: 300 }, { size: "Large" }), ChoiceError);
  assert.equal(priceChoice({ name: "Bagel", cents: 300 }).cents, 300);
});

test("prices read the way a menu shows them, and the chat is told which extras go where", () => {
  assert.equal(priceLabel({ cents: 450 }), "$4.50");
  assert.equal(priceLabel({ cents: 450, sizes: [{ name: "Small", cents: 450 }, { name: "Large", cents: 550 }] }), "Small $4.50 / Large $5.50");
  assert.equal(priceLabel({ min: 300, max: 400 }), "$3.00-$4.00");
  const menu = { optionGroups: { milk: MILK }, groups: { Drinks: { Coffee: [{ id: "a", name: "Latte", options: ["milk"] }, { id: "b", name: "Hidden", hidden: true }], Tea: [{ id: "c", name: "Earl Grey" }, { id: "d", name: "Chai", options: ["milk"] }] } } };
  const [line] = choicesLines(menu);
  assert.match(line, /^Milk \[set id: milk\] \(\+\$1\.00 each\): Oat milk, Almond milk\. Choose one\. Offered on: every item in Coffee; Chai\.$/);
  assert.deepEqual(choicesLines({ groups: {} }), []);
});

test("the built-in chat answers questions about extras from the menu's own choices", async () => {
  const { basicAnswer } = await import("./lib/answers.mjs");
  const { normalizeContent } = await import("./lib/content.mjs");
  const { readFileSync } = await import("node:fs");
  const content = normalizeContent(JSON.parse(readFileSync(new URL("./public/content.default.json", import.meta.url), "utf8"))).content;
  const menu = JSON.parse(readFileSync(new URL("./public/menu.json", import.meta.url), "utf8"));
  const ask = (q) => basicAnswer(content, menu, [{ role: "user", content: q }], new Date(), { ordering: true });
  assert.match(ask("how much is oat milk").reply, /Alternative milk: Oat milk \+\$1\.00, Almond milk \+\$1\.00/);
  assert.match(ask("what syrups do you have").reply, /Syrup: Vanilla \+\$0\.50, Caramel \+\$0\.50, Hazelnut \+\$0\.50/);
  assert.match(ask("what are the breakfast add ons").reply, /Turkey bacon \+\$2\.00/);
  assert.doesNotMatch(ask("what are the breakfast add ons").reply, /Grilled chicken/);
  assert.match(ask("how much is a large cold brew").reply, /Cold Brew: Small \$4\.50 \/ Large \$5\.00/);
  assert.match(ask("how much is oat brown sugar").reply, /Oat Brown Sugar: Small \$6\.50/, "an item with a name like an extra is still an item");
  assert.equal(ask("how much is oat milk").handoff, undefined);
});
