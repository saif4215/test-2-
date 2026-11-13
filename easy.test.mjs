// The "easy to run" pieces: saved settings, the guided setup, and the start script's choices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseEnv, envValue, loadDotEnv } from "./lib/env.mjs";
import { makePassword, renderEnv, runSetup } from "./scripts/setup.mjs";
import { startPage, nodeTooOld } from "./scripts/start.mjs";

test("saved settings read back exactly, including values with spaces and # marks", () => {
  const values = { ADMIN_PASSWORD: "abc DEF #12345", NOTIFY_EMAIL: "me@cafe.com", SQUARE_ACCESS_TOKEN: "EAAA-b_c.d", TAX_PERCENT: "8.875", Q: "it's fine" };
  const back = parseEnv(renderEnv(values));
  for (const [k, v] of Object.entries(values)) assert.equal(back[k], v, k);
  assert.equal(envValue("a\nb"), null, "a line break cannot be stored");
  assert.equal(envValue(`both ' and "`), null);
  assert.throws(() => renderEnv({ X: `both ' and "` }), /cannot contain/);
});

test("parseEnv ignores comments and blank lines and trailing comments, and accepts quotes and export", () => {
  const got = parseEnv('# hi\n\nA=1\nexport B="two words" # note\nC=\'x#y\'\nD=plain # note\nnot a setting\n');
  assert.deepEqual(got, { A: "1", B: "two words", C: "x#y", D: "plain" });
});

test("a setting already set outside (a host's own settings) wins over the file", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "maruf-env-"));
  try {
    writeFileSync(path.join(dir, ".env"), "A=file\nB=file\nC=\n");
    const env = { A: "host" };
    assert.deepEqual(loadDotEnv(dir, env), ["B"]);
    assert.deepEqual(env, { A: "host", B: "file" });
    assert.deepEqual(loadDotEnv(path.join(dir, "missing"), {}), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function script(answers) {
  const asked = [];
  const queue = [...answers];
  return { asked, ask: async (q) => { asked.push(q); if (!queue.length) throw new Error(`ran out of answers at: ${q}`); return queue.shift(); }, say: () => {}, left: () => queue.length };
}

test("setup with all Enter: makes a password and turns nothing else on", async () => {
  const s = script(["", "", "", ""]);
  const v = await runSetup({ ask: s.ask, say: s.say, password: () => "GeneratedPass1" });
  assert.equal(v.ADMIN_PASSWORD, "GeneratedPass1");
  assert.deepEqual(Object.keys(v), ["ADMIN_PASSWORD"]);
  assert.equal(s.left(), 0);
});

test("setup with email and Square: saves each answer, rejects a short password and a bad tax", async () => {
  const s = script(["short", "y", "me@cafe.com", "re_key", "y", "n", "SQTOKEN", "LOC1", "abc", "8.875", "n"]);
  const logs = [];
  const v = await runSetup({ ask: s.ask, say: (t) => logs.push(t), password: () => "GeneratedPass2" });
  assert.equal(v.ADMIN_PASSWORD, "GeneratedPass2", "a too-short password is replaced by a made one");
  assert.equal(v.NOTIFY_EMAIL, "me@cafe.com");
  assert.equal(v.RESEND_API_KEY, "re_key");
  assert.equal(v.SQUARE_ENV, "sandbox", "test orders unless the owner says real");
  assert.equal(v.SQUARE_ACCESS_TOKEN, "SQTOKEN");
  assert.equal(v.SQUARE_LOCATION_ID, "LOC1");
  assert.equal(v.TAX_PERCENT, "8.875");
  assert.ok(logs.some((l) => /Type just the number/.test(l)), "a bad tax is explained, then asked again");
  assert.equal(s.left(), 0);
});

test("running setup again keeps what is saved, and turning a thing off removes it", async () => {
  const old = { ADMIN_PASSWORD: "oldpassword123", NOTIFY_EMAIL: "me@cafe.com", RESEND_API_KEY: "k", SQUARE_ENV: "production", SQUARE_ACCESS_TOKEN: "T", SQUARE_LOCATION_ID: "L", TAX_PERCENT: "8.875", CUSTOM: "kept" };
  const keepAll = script(["", "", "", "", "", "", "", "", "", ""]);
  const kept = await runSetup({ ask: keepAll.ask, say: () => {}, old });
  const text = renderEnv(kept, old);
  assert.deepEqual(parseEnv(text), old, "pressing Enter all the way changes nothing, and unknown settings survive");
  const off = script(["", "n", "n", ""]);
  const gone = await runSetup({ ask: off.ask, say: () => {}, old });
  const back = parseEnv(renderEnv(gone, old));
  assert.equal(back.NOTIFY_EMAIL, undefined);
  assert.equal(back.SQUARE_ACCESS_TOKEN, undefined);
  assert.equal(back.ADMIN_PASSWORD, "oldpassword123");
  assert.equal(back.CUSTOM, "kept");
});

test("made passwords are long enough for the dashboard and easy to read", () => {
  for (let i = 0; i < 20; i++) { const p = makePassword(); assert.ok(p.length >= 10); assert.match(p, /^[A-Za-z2-9]+$/); assert.doesNotMatch(p, /[0OIl1]/); }
});

test("the start script opens the dashboard once a password is set, otherwise the app", () => {
  assert.equal(startPage({ ADMIN_PASSWORD: "longenough1" }, 8080), "http://localhost:8080/admin/");
  assert.equal(startPage({}, 9000), "http://localhost:9000/app/");
  assert.equal(startPage({ ADMIN_PASSWORD: "short" }, 8080), "http://localhost:8080/app/");
  assert.equal(nodeTooOld("20.1.0"), true);
  assert.equal(nodeTooOld("22.12.9"), true);
  assert.equal(nodeTooOld("22.13.0"), false);
  assert.equal(nodeTooOld("24.0.0"), false);
});
