// Explicit real-model acceptance; requires previously installed native models.
// KV_VOCALS_REAL_DATA must point to a disposable companion acceptance directory.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { launchBrowser, preview, goToView } from "../tests/browser-support.js";

const root = process.env.KV_VOCALS_REAL_DATA;
if (!root)
  throw Error(
    "Set KV_VOCALS_REAL_DATA to the acceptance companion data directory.",
  );
const child = spawn(
  "python",
  [
    "-u",
    "-c",
    `import json,sys\nfrom pathlib import Path\nfrom kv_companion.server import CompanionServer\ns=CompanionServer(Path(sys.argv[1]),19738)\nprint(json.dumps({'code':s.pairing.code}),flush=True)\ns.serve_forever()`,
    root,
  ],
  {
    env: { ...process.env, PYTHONPATH: resolve("companion") },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "",
  errorOutput = "";
child.stderr.on("data", (data) => {
  errorOutput += data;
});
const code = await new Promise((accept, reject) => {
  const timer = setTimeout(
    () => reject(Error(errorOutput || "Companion did not start")),
    15000,
  );
  child.stdout.on("data", (data) => {
    output += data;
    if (output.includes("\n")) {
      clearTimeout(timer);
      accept(JSON.parse(output.split("\n")[0]).code);
    }
  });
  child.on("error", reject);
  child.on("exit", () => reject(Error(errorOutput || "Companion exited")));
});
const server = preview(4256);
let browser;
try {
  await server.ready();
  browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "block",
  });
  page.setDefaultTimeout(180000);
  await page.goto(server.url + "/?qa=1");
  await goToView(page, "audio");
  await page.evaluate(async () => {
    const { createEmptyProject } = await import("/core.js");
    const p = createEmptyProject();
    p.tempo = 120;
    p.swing = 0;
    const c = p.clips.find((c) => c.id === p.activeClipIds.lead);
    c.notes = [60, 64, 67, 65].map((pitch, i) => ({
      id: "real-vocal-" + i,
      step: i * 4,
      length: 4,
      pitch,
      velocity: 0.8,
      offset: 0,
      expression: { pressure: 0, timbre: 0, bend: 0 },
    }));
    localStorage.setItem("kiber-vengance-project-v6", JSON.stringify(p));
  });
  await page.reload();
  await goToView(page, "audio");
  await page.locator("#desktopVocalsBtn").click();
  await page.locator("#desktopPairCode").fill(code);
  await page.locator("#desktopPair").click();
  await page.waitForFunction(
    () => !document.querySelector("#generateDesktopVocals").disabled,
  );
  await page.locator("#desktopVocalDevice").selectOption("cpu");
  await page.locator("#captureVocalNotes").click();
  await page.locator("#desktopScoreLyrics").fill("Ho la mun do");
  await page.getByRole("button", { name: "Apply lyrics", exact: true }).click();
  const evidence = [];
  for (const engine of ["diffsinger", "acestep"]) {
    if (engine === "acestep") {
      await page.locator("#desktopVocalEngine").selectOption(engine);
      await page
        .locator("#desktopAceLyrics")
        .fill(
          "[Verse]\nLa noche arde, vuelve a despertar.\n[Chorus]\nSomos la luz, vamos a luchar.",
        );
      await page
        .locator("#desktopAceStyle")
        .fill(
          "Industrial electro rock, expressive Spanish lead vocals, energetic singing",
        );
      await page.locator("#desktopAceDuration").fill("10");
    }
    const previous = (await page.locator("#desktopVocalPreview").count())
      ? await page.locator("#desktopVocalPreview").getAttribute("src")
      : null;
    const started = Date.now();
    console.log("Generating real " + engine);
    await page.locator("#generateDesktopVocals").click();
    await page.waitForTimeout(100);
    await page.waitForFunction(
      () => !document.querySelector("#generateDesktopVocals").disabled,
      null,
      { timeout: 180000 },
    );
    assert.equal(
      await page.locator("#desktopVocalPreview").count(),
      1,
      await page.locator("#desktopVocalsDialog").innerText(),
    );
    assert.notEqual(
      await page.locator("#desktopVocalPreview").getAttribute("src"),
      previous,
      await page.locator("#desktopVocalsDialog").innerText(),
    );
    const audio = page.locator("#desktopVocalPreview");
    await audio.evaluate((el) => el.play());
    await page.waitForTimeout(200);
    assert.equal(await audio.evaluate((el) => el.paused), false);
    await audio.evaluate((el) => el.pause());
    await page.locator("#insertDesktopVocals").click();
    await page.waitForFunction(
      () => !document.querySelector("#insertDesktopVocals").disabled,
    );
    await page.waitForTimeout(350);
    const region = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("kiber-vengance-project-v6"))
        .audioLanes.at(-1)
        .regions.at(-1),
    );
    assert.equal(region.generation.engine, engine);
    assert.equal(region.generation.kind, "singing");
    assert.ok(region.generation.sha256.length === 64);
    evidence.push({
      engine,
      elapsedUISeconds: (Date.now() - started) / 1000,
      generation: region.generation,
    });
  }
  await page.locator("#desktopVocalsDialog header button").click();
  await page.reload();
  await goToView(page, "audio");
  assert.equal(await page.locator(".audio-region").count(), 2);
  const report = {
    date: new Date().toISOString(),
    realModelInference: true,
    physicalListening: false,
    reloadedRegions: 2,
    engines: evidence,
  };
  await writeFile(
    "/tmp/kv-desktop-vocals-real-browser.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.close();
  child.kill("SIGTERM");
}
