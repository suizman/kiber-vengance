import { routeVoiceDownloads } from "./voice-test-mirror.mjs";
import { tmpdir } from "node:os";
// Opt-in real Kokoro inference. Downloads weights; excluded from normal E2E.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, preview, goToView } from "../tests/browser-support.js";
const server = preview(Number(process.env.VOICE_TEST_PORT) || 4241);
let browser, monitor, closeMirror;
try {
  await server.ready();
  browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 1366, height: 1000 },
    acceptDownloads: true,
  });
  closeMirror = await routeVoiceDownloads(page.context());
  page.on("pageerror", (error) => console.log("Page error:", error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      console.log("Browser error:", message.text());
  });
  await page.goto(`${server.url}/?qa=1`, { waitUntil: "networkidle" });
  await goToView(page, "audio");
  await page.locator("#localVoiceBtn").click();
  monitor = setInterval(async () => {
    try {
      console.log(
        "Voice progress:",
        await page.locator("#localVoiceDialog [role=status]").textContent(),
      );
    } catch {}
  }, 10000);
  for (const language of ["en", "es"]) {
    await page.locator("#voiceLanguage").selectOption(language);
    await page
      .locator("#voicePrecision")
      .selectOption(process.env.VOICE_PRECISION || "q8");
    await page
      .locator("#voiceText")
      .fill(
        language === "es"
          ? "La noche se enciende. Nuestra voz cruza el horizonte."
          : "The night comes alive. Our voices cross the horizon.",
      );
    await page.locator("#loadLocalVoice").click();
    await page.waitForFunction(
      () =>
        /Error/.test(
          globalThis.document.querySelector("#localVoiceDialog [role=status]")
            .textContent,
        ) ||
        globalThis.document.querySelector("#localVoiceDialog [role=status]")
          .textContent === "Model ready" ||
        (!globalThis.document.querySelector("#loadLocalVoice").disabled &&
          !globalThis.document.querySelector("#generateLocalVoice").disabled),
      null,
      { timeout: 300000 },
    );
    assert.equal(
      await page.locator("#generateLocalVoice").isEnabled(),
      true,
      await page.locator("#localVoiceDialog [role=status]").textContent(),
    );
    const oldUrl = (await page.locator("#voicePreview").count())
      ? await page.locator("#voicePreview").getAttribute("src")
      : null;
    const started = Date.now();
    await page.locator("#generateLocalVoice").click();
    await page.waitForFunction(
      (old) =>
        /Error/.test(
          globalThis.document.querySelector("#localVoiceDialog [role=status]")
            .textContent,
        ) ||
        (globalThis.document.querySelector("#voicePreview")?.src !== old &&
          globalThis.document.querySelector("#voicePreview")?.src &&
          !globalThis.document.querySelector("#loadLocalVoice").disabled),
      oldUrl,
      { timeout: 300000 },
    );
    assert.ok(
      !/Error/.test(
        await page.locator("#localVoiceDialog [role=status]").textContent(),
      ),
      await page.locator("#localVoiceDialog [role=status]").textContent(),
    );
    assert.equal(
      await page.locator("#insertLocalVoice").count(),
      1,
      await page.locator("#localVoiceDialog [role=status]").textContent(),
    );
    const wav = await page
      .locator("#voicePreview")
      .evaluate(async (audio) => [
        ...new Uint8Array(await (await fetch(audio.src)).arrayBuffer()),
      ]);
    assert.ok(wav.length > 48000);
    const data = Buffer.from(wav);
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    await mkdir(`${tmpdir()}/kiber-voice-samples`, { recursive: true });
    await writeFile(
      `${tmpdir()}/kiber-voice-samples/${language}-${process.env.VOICE_PRECISION || "q8"}.wav`,
      data,
    );
    console.log(
      `Real ${language} generation: ${Date.now() - started} ms, ${wav.length} bytes`,
    );
    await page.locator("#insertLocalVoice").click();
    await page.waitForFunction(
      () => !globalThis.document.querySelector("#loadLocalVoice").disabled,
    );
    await page.waitForTimeout(400);
  }
  const onlineUrl = await page.locator("#voicePreview").getAttribute("src");
  await page.context().setOffline(true);
  await page.locator("#generateLocalVoice").click();
  await page.waitForFunction(
    (previous) => {
      const next = globalThis.document
        .querySelector("#voicePreview")
        ?.getAttribute("src");
      return (
        next &&
        next !== previous &&
        !globalThis.document.querySelector("#loadLocalVoice").disabled
      );
    },
    onlineUrl,
    { timeout: 300000 },
  );
  await page.context().setOffline(false);
  console.log("Real retained-worker offline Spanish inference passed.");
  await page.locator("#localVoiceDialog header button").click();
  const saved = await page.evaluate(() =>
    JSON.parse(globalThis.localStorage.getItem("kiber-vengance-project-v6")),
  );
  assert.equal(
    saved.audioLanes
      .flatMap((l) => l.regions)
      .filter((r) => r.generation?.kind === "speech").length,
    2,
  );
  await page.locator("#undoBtn").click();
  await page.locator("#redoBtn").click();
  await page.reload({ waitUntil: "networkidle" });
  await goToView(page, "audio");
  assert.equal(await page.locator(".audio-region").count(), 2);
  console.log(
    "Voice insertion, Undo/Redo and reload passed. Samples require human listening; no perceptual-quality claim.",
  );
} finally {
  clearInterval(monitor);
  await browser?.close();
  closeMirror?.();
  server.close();
}
