import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import axe from "axe-core";
import { launchBrowser, preview, goToView } from "./browser-support.js";

const server = preview(4256);
after(() => server.close());

async function companion(t) {
  const child = spawn(
    process.env.PYTHON_EXECUTABLE || "python",
    ["companion/tests/browser_server.py"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => child.kill("SIGTERM"));
  let output = "",
    errors = "";
  child.stderr.on("data", (data) => {
    errors += data;
  });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Protocol fixture did not start: " + errors)),
      10000,
    );
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (!output.includes("\n")) {
        clearTimeout(timer);
        reject(Error("Protocol fixture exited " + code + ": " + errors));
      }
    });
    child.stdout.on("data", (data) => {
      output += data;
      if (output.includes("\n")) {
        clearTimeout(timer);
        resolve(JSON.parse(output.split("\n")[0]));
      }
    });
  });
  return result;
}

test("desktop vocals pair with the real loopback server, capture notes, audition, insert, undo and reload (HTTP protocol fixture)", async (t) => {
  await server.ready();
  const local = await companion(t),
    browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.url + "/?qa=1");
  await goToView(page, "audio");
  await page.evaluate(async () => {
    const { createEmptyProject } = await import("/core.js");
    const p = createEmptyProject();
    p.tempo = 120;
    p.swing = 0;
    const c = p.clips.find((c) => c.id === p.activeClipIds.lead);
    c.notes = [60, 64, 67, 65].map((pitch, i) => ({
      id: "vocal-" + i,
      step: i * 4,
      length: 4,
      pitch,
      velocity: 0.8,
      offset: 0,
      expression: { pressure: 0, timbre: 0, bend: 0 },
    }));
    globalThis.localStorage.setItem(
      "kiber-vengance-project-v6",
      JSON.stringify(p),
    );
  });
  await page.reload();
  await goToView(page, "audio");
  await page.locator("#desktopVocalsBtn").click();
  assert.equal(await page.locator("#generateDesktopVocals").isDisabled(), true);
  await page.locator("#desktopPairCode").fill(local.code);
  await page.locator("#desktopPair").click();
  await page.waitForFunction(
    () => !document.querySelector("#generateDesktopVocals").disabled,
  );
  await page.locator("#captureVocalNotes").click();
  assert.equal(await page.locator(".desktop-note-list tbody tr").count(), 4);
  await page.locator("#desktopScoreLyrics").fill("Ho la mun do");
  await page.getByRole("button", { name: "Apply lyrics", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Lyric for note 1", exact: true })
      .inputValue(),
    "Ho",
  );
  await page.locator("#generateDesktopVocals").click();
  await page.locator("#desktopVocalPreview").waitFor();
  await page.locator("#desktopVocalsDialog .audio-fx summary").click();
  await page
    .locator("#desktopVocalsDialog .audio-fx select")
    .selectOption("presence");
  await page.locator("#insertDesktopVocals").click();
  await page.waitForFunction(
    () => !document.querySelector("#insertDesktopVocals").disabled,
  );
  await page.locator("#desktopVocalsDialog header button").click();
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() =>
    JSON.parse(globalThis.localStorage.getItem("kiber-vengance-project-v6")),
  );
  const region = stored.audioLanes.at(-1).regions.at(-1);
  assert.equal(region.generation.kind, "singing");
  assert.equal(region.generation.engine, "diffsinger");
  assert.equal(region.generation.settings.notes[0].lyric, "Ho");
  assert.equal(region.generation.outputKind, "score-vocal");
  assert.ok(region.effects.compression > 0);
  assert.ok(region.assetId.startsWith("singing-"));
  await page.locator("#undoBtn").click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".audio-region").count(), 0);
  await page.locator("#redoBtn").click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".audio-region").count(), 1);
  await page.reload();
  await goToView(page, "audio");
  assert.equal(await page.locator(".audio-region").count(), 1);
  await page.locator("#desktopVocalsBtn").click();
  await page
    .getByRole("button", { name: "Check connection", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector("#generateDesktopVocals").disabled,
  );
  await page.locator("#desktopVocalEngine").selectOption("acestep");
  await page.locator("#desktopAceLyrics").fill("La noche arde.");
  await page
    .locator("#desktopAceStyle")
    .fill("Industrial rock, energetic Spanish singing");
  const previous = (await page.locator("#desktopVocalPreview").count())
    ? await page.locator("#desktopVocalPreview").getAttribute("src")
    : null;
  await page.locator("#generateDesktopVocals").click();
  await page.waitForFunction(
    (previous) =>
      !!document.querySelector("#desktopVocalPreview")?.getAttribute("src") &&
      document.querySelector("#desktopVocalPreview")?.getAttribute("src") !==
        previous &&
      !document.querySelector("#generateDesktopVocals").disabled,
    previous,
  );
  const retained = await page
    .locator("#desktopVocalPreview")
    .getAttribute("src");
  await page.locator("#generateDesktopVocals").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#desktopVocalsStatus")
        .textContent.startsWith("Cancelled") &&
      !document.querySelector("#generateDesktopVocals").disabled,
  );
  await page.waitForTimeout(500);
  assert.equal(
    await page.locator("#desktopVocalPreview").getAttribute("src"),
    retained,
  );
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () =>
    (await axe.run(document.querySelector("#desktopVocalsDialog"))).violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  );
  assert.deepEqual(violations, []);
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: resolve(tmpdir(), "kiber-desktop-vocals.png"),
  });
  const owner = await browser.newPage({
    serviceWorkers: "block",
    bypassCSP: true,
  });
  await owner.goto(local.ownerUrl);
  await owner.locator("#pairCode").filter({ hasText: /\d{6}/ }).waitFor();
  await owner.addScriptTag({ content: axe.source });
  const ownerViolations = await owner.evaluate(async () =>
    (await axe.run()).violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => v.id),
  );
  assert.deepEqual(ownerViolations, []);
  const download = await owner
    .getByRole("button", { name: "WAV", exact: true })
    .first()
    .elementHandle();
  await download.focus();
  await owner.waitForTimeout(2400);
  assert.equal(
    await download.evaluate(
      (element) => element === document.activeElement && element.isConnected,
    ),
    true,
  );
});

test("desktop singing explains mobile compatibility without probing or downloading a local engine", async (t) => {
  await server.ready();
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    serviceWorkers: "block",
  });
  let localRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("127.0.0.1:19738")) localRequests++;
  });
  await page.goto(server.url + "/?qa=1");
  await goToView(page, "audio");
  await page.locator("#desktopVocalsBtn").click();
  await page
    .getByText("Open this feature on a Mac, Windows or Linux computer.", {
      exact: false,
    })
    .waitFor();
  assert.equal(await page.locator("#generateDesktopVocals").count(), 0);
  assert.equal(localRequests, 0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
    true,
  );
});
