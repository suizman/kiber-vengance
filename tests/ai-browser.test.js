import test from "node:test";
import assert from "node:assert/strict";
import axe from "axe-core";
import { launchBrowser, preview } from "./browser-support.js";

const server = preview(Number(process.env.AI_UI_TEST_PORT) || 4233);
test.after(() => server.close());
// A worker protocol fixture isolates UI/state/undo tests. Real inference is
// validated separately by scripts/test-local-ai.mjs; this is not model evidence.
const fixture = `let count=0;self.onmessage=({data})=>{
 if(data.kind==='load')self.postMessage({kind:'loaded'});
 if(data.kind==='generate'){
  count++;
  self.postMessage({kind:'progress',progress:0,text:'UI fixture generation '+count});
  setTimeout(()=>self.postMessage({kind:'result',text:JSON.stringify({title:'Fixture '+count,motif:count%2?[0,2,4,7,5,3,2,0]:[7,5,3,0,2,4,2,0],rhythm:'syncopated',contour:'arch',articulation:'short',energy:.8})}),150);
 }
};`;
const notes = (page) =>
  page.locator(".ai-note-preview i").evaluateAll((nodes) =>
    nodes.map((n) => ({
      onset: +n.dataset.aiOnset,
      pitch: +n.dataset.aiPitch,
      length: +n.dataset.aiLength,
    })),
  );
const ready = (page) =>
  page.waitForFunction(() =>
    document.querySelector("#localAIStatus")?.textContent.startsWith("Ready"),
  );

test("AI composition integrates context, shaping, A/B loops, selected bars, recipes and undo with one model call per generation", async (t) => {
  await server.ready();
  const browser = await launchBrowser();
  t.after(() => browser.close());
  for (const viewport of [
    { width: 1366, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport, serviceWorkers: "block" }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      globalThis.__previewContexts = [];
      const Native = globalThis.AudioContext;
      globalThis.AudioContext = class extends Native {
        constructor(...args) {
          super(...args);
          globalThis.__previewContexts.push(this);
        }
      };
    });
    await page.route("**/cpu-worker-*.js", (r) =>
      r.fulfill({ contentType: "text/javascript", body: fixture }),
    );
    await page.goto(server.url, { waitUntil: "networkidle" });
    const clips = await page.locator("#clipSelect option").count();
    await page.locator("#composeAIMelodyBtn").click();
    assert.match(
      await page.locator("#aiContextSummary").textContent(),
      /Reference.*Accompaniment/,
    );
    await page.locator("#aiMode").selectOption("continue");
    await page.locator("#localAIBackend").selectOption("cpu");
    await page.locator("#loadLocalAI").click();
    await ready(page);
    assert.equal(
      await page.locator("#generateLocalAI").isEnabled(),
      true,
      "continuation needs no mandatory prompt",
    );
    await page.locator("#aiPrompt").fill("A dark evolving melody");
    await page.locator("#aiTempo").fill("220");
    await page.locator("#aiBars").selectOption("1");
    await page.locator("#aiCompositionControls > summary").click();
    await page.locator("#aiDensity").selectOption("8");
    await page.locator("#aiRegister").selectOption("high");
    await page.locator("#aiMaxLeap").selectOption("5");
    await page.locator("#aiRecipeLibrary > summary").click();
    await page.locator("#aiRecipeName").fill("Night continuation");
    await page.locator("#saveAIRecipe").click();
    const recipe = page.locator("[data-ai-recipe]").first();
    await recipe.getByRole("button", { name: /Favorite:/ }).click();
    assert.equal(
      await recipe
        .getByRole("button", { name: /Favorite:/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    await recipe.locator("details summary").click();
    await recipe.locator("input[name=name]").fill("Night signal");
    await recipe.getByRole("button", { name: "Save name" }).click();
    assert.equal(await recipe.locator("b").textContent(), "Night signal");
    await recipe.getByRole("button", { name: "Delete", exact: true }).click();
    assert.equal(await page.locator("[data-ai-recipe]").count(), 0);
    await page.getByRole("button", { name: /Undo delete/ }).click();
    assert.equal(await page.locator("[data-ai-recipe]").count(), 1);
    await page.locator("#aiRecipeLibrary > summary").click();
    await page.locator("#generateLocalAI").click();
    await page.locator(".ai-result").waitFor();
    await ready(page);
    assert.equal(await page.locator("[data-ai-proposal]").count(), 3);
    assert.equal((await notes(page)).length, 8);
    assert.match(
      await page.locator(".ai-result h3").textContent(),
      /Fixture 1/,
    );
    const beforeTempo = await notes(page);
    await page.locator("#aiTempo").fill("180");
    assert.deepEqual(await notes(page), beforeTempo);
    await page.locator("#aiTempo").fill("");
    assert.equal(await page.locator("#applyLocalAI").isDisabled(), true);
    assert.equal(await page.locator("#auditionLocalAI").isDisabled(), true);
    await page.locator("#aiTempo").fill("220");
    const a = await notes(page);
    await page.locator('[data-ai-proposal="1"]').click();
    const b = await notes(page);
    assert.notDeepEqual(a, b);
    await page.locator("#auditionLocalAI").click();
    await page.waitForFunction(() =>
      globalThis.__previewContexts.some((c) => c.state === "running"),
    );
    await page.locator('[data-ai-proposal="0"]').click();
    await page.waitForTimeout(1600);
    assert.equal(
      await page.evaluate(() => globalThis.__previewContexts.length),
      1,
      "A/B reuses the same AudioContext",
    );
    assert.equal(
      await page.evaluate(() => globalThis.__previewContexts[0].state),
      "running",
    );
    await page.locator("#auditionLocalAI").click();
    await page.waitForFunction(() =>
      globalThis.__previewContexts.every((c) => c.state === "closed"),
    );
    await page.locator("#aiDensity").selectOption("4");
    assert.equal((await notes(page)).length, 4);
    assert.match(
      await page.locator(".ai-result h3").textContent(),
      /Fixture 1/,
      "shaping does not call the model again",
    );
    await page.locator("#aiBars").selectOption("4");
    await page.locator("#generateLocalAI").click();
    await page.locator(".ai-result").waitFor();
    await ready(page);
    const before = await notes(page);
    await page.locator('[data-ai-bar="1"]').click();
    await page.locator("#regenerateAIBars").click();
    await page.waitForFunction(
      () =>
        document.querySelector(".ai-detail")?.textContent.includes("3") ||
        document
          .querySelector("#localAIStatus")
          ?.textContent.startsWith("Ready"),
    );
    await ready(page);
    assert.equal(
      await page.locator(".ai-error").count(),
      0,
      await page.locator(".ai-error").allTextContents(),
    );
    const after = await notes(page);
    assert.deepEqual(
      after.filter((n) => n.onset < 16 || n.onset >= 32),
      before.filter((n) => n.onset < 16 || n.onset >= 32),
    );
    await page.screenshot({
      path: `/private/tmp/kiber-ai-composer-${viewport.width}.png`,
    });
    await page.addScriptTag({ content: axe.source });
    const audit = await page.evaluate(() =>
      globalThis.axe.run(document.querySelector("#localAIDialog")),
    );
    assert.deepEqual(
      audit.violations
        .filter((v) => ["serious", "critical"].includes(v.impact))
        .map((v) => v.id),
      [],
    );
    assert.equal(
      await page
        .locator("#localAIDialog")
        .evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      true,
    );
    await page.locator("#applyLocalAI").click();
    assert.equal(await page.locator("#clipSelect option").count(), clips + 1);
    await page.locator("#undoBtn").click();
    assert.equal(await page.locator("#clipSelect option").count(), clips);
    await page.locator("#redoBtn").click();
    assert.equal(await page.locator("#clipSelect option").count(), clips + 1);
    await page.waitForTimeout(600);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#clipSelect option").count(), clips + 1);
    await page.locator("#composeAIMelodyBtn").click();
    await page.locator("#aiRecipeLibrary > summary").click();
    await page.locator("#aiRecipeSearch").fill("night");
    assert.equal(await page.locator("[data-ai-recipe]").count(), 1);
    await page
      .locator("[data-ai-recipe]")
      .getByRole("button", { name: "Use recipe" })
      .click();
    assert.equal(await page.locator("#aiMode").inputValue(), "continue");
    assert.equal(await page.locator("#aiDensity").inputValue(), "8");
    assert.equal(await page.locator("#aiRegister").inputValue(), "high");
    assert.equal(await page.locator("#aiBars").inputValue(), "1");
    assert.equal(await page.locator("#aiApplyTempo").isChecked(), false);
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    await page.close();
  }
});

test("personal recipe storage failure is visible and does not pretend to persist", async (t) => {
  await server.ready();
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.locator("#composeAIMelodyBtn").click();
  await page.locator("#aiPrompt").fill("A simple motif");
  await page.locator("#aiRecipeLibrary > summary").click();
  await page.locator("#aiRecipeName").fill("Cannot save");
  await page.evaluate(() => {
    const original = globalThis.Storage.prototype.setItem;
    globalThis.Storage.prototype.setItem = function (key, value) {
      if (key === "kv-ai-recipes-v1") throw new Error("Quota");
      return original.call(this, key, value);
    };
  });
  await page.locator("#saveAIRecipe").click();
  assert.match(
    await page.locator("#aiRecipeLibrary [role=alert]").textContent(),
    /Could not/,
  );
  assert.equal(await page.locator("[data-ai-recipe]").count(), 0);
});

test("closing AI preview during audio startup releases its context and prevents delayed playback", async (t) => {
  await server.ready();
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage({ serviceWorkers: "block" });
  await page.addInitScript(() => {
    globalThis.__contexts = [];
    const Native = globalThis.AudioContext;
    globalThis.AudioContext = class extends Native {
      constructor(...args) {
        super(...args);
        globalThis.__contexts.push(this);
      }
    };
    const original = globalThis.Worklet.prototype.addModule;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    globalThis.__releasePreview = release;
    globalThis.Worklet.prototype.addModule = async function (...args) {
      await gate;
      return original.apply(this, args);
    };
  });
  await page.route("**/cpu-worker-*.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: fixture }),
  );
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.locator("#composeAIMelodyBtn").click();
  await page.locator("#localAIBackend").selectOption("cpu");
  await page.locator("#loadLocalAI").click();
  await ready(page);
  await page.locator("#aiPrompt").fill("A rising melody");
  await page.locator("#generateLocalAI").click();
  await page.locator(".ai-result").waitFor();
  await page.locator("#auditionLocalAI").click();
  await page.waitForFunction(() => globalThis.__contexts.length > 0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => globalThis.__releasePreview());
  await page.waitForFunction(() =>
    globalThis.__contexts.every((c) => c.state === "closed"),
  );
  assert.equal(
    await page.locator("#localAIDialog").evaluate((n) => n.open),
    false,
  );
});

test("Spanish compact composer explains source rhythm and keeps result actions reachable", async (t) => {
  await server.ready();
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage({
    viewport: { width: 320, height: 844 },
    serviceWorkers: "block",
  });
  await page.route("**/cpu-worker-*.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: fixture }),
  );
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.locator("#menuBtn").click();
  await page.locator("#menuLanguageSelect").selectOption("es");
  await page.keyboard.press("Escape");
  await page.locator("#composeAIMelodyBtn").click();
  await page.locator("#aiMode").selectOption("variation");
  assert.equal(await page.locator("#aiRhythm").inputValue(), "source");
  assert.equal(await page.locator("#aiRhythm").isDisabled(), true);
  await page.locator("#aiCompositionControls > summary").click();
  await page.locator("#aiDensity").selectOption("4");
  assert.equal(await page.locator("#aiRhythm").isEnabled(), true);
  await page.locator("#aiCompositionControls > summary").click();
  await page.locator("#localAIBackend").selectOption("cpu");
  await page.locator("#loadLocalAI").click();
  await page.waitForFunction(() =>
    document.querySelector("#localAIStatus")?.textContent.startsWith("Listo"),
  );
  await page.locator("#generateLocalAI").click();
  await page.locator(".ai-result").waitFor();
  await page.locator("#applyLocalAI").scrollIntoViewIfNeeded();
  assert.equal(
    await page
      .locator("#localAIDialog")
      .evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
    true,
  );
  assert.equal(
    await page.locator(".appearance-close").last().isVisible(),
    true,
  );
  await page.screenshot({ path: "/private/tmp/kiber-ai-composer-es-320.png" });
  await page.addScriptTag({ content: axe.source });
  const audit = await page.evaluate(() =>
    globalThis.axe.run(document.querySelector("#localAIDialog")),
  );
  assert.deepEqual(
    audit.violations
      .filter((v) => ["serious", "critical"].includes(v.impact))
      .map((v) => v.id),
    [],
  );
  assert.match(await page.locator("#applyLocalAI").textContent(), /Añadir/);
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#localAIDialog").evaluate((n) => n.open),
    false,
  );
});

test('quality mode makes three sequential calls and preserves proposals after cancellation', {timeout:30000}, async t=>{
  await server.ready();const browser=await launchBrowser();t.after(()=>browser.close());const page=await browser.newPage({serviceWorkers:"block"});
  await page.addInitScript(()=>{globalThis.__modelCalls=0;const Native=globalThis.Worker;globalThis.Worker=class extends Native{postMessage(message,...args){if(message.kind==='generate')globalThis.__modelCalls++;return super.postMessage(message,...args)}}});
  await page.route('**/cpu-worker-*.js',route=>route.fulfill({contentType:'text/javascript',body:fixture}));
  await page.goto(`${server.url}/?qa=1`,{waitUntil:'networkidle'});await page.locator('#composeAIMelodyBtn').click();await page.locator('#localAIBackend').selectOption('cpu');await page.locator('#loadLocalAI').click();await ready(page);
  await page.locator('#aiPrompt').fill('A cinematic answer');await page.locator('#aiQuality').check();await page.locator('#generateLocalAI').click();await page.waitForFunction(()=>globalThis.document.querySelector('.ai-result')||globalThis.document.querySelector('.ai-error'),null,{timeout:15000}).catch(async error=>{throw new Error(JSON.stringify(await page.evaluate(()=>({status:globalThis.document.querySelector('#localAIStatus')?.textContent,detail:globalThis.document.querySelector('.ai-detail')?.textContent,calls:globalThis.__modelCalls,quality:globalThis.document.querySelector('#aiQuality')?.checked}))),{cause:error})});assert.equal(await page.locator('.ai-error').count(),0,await page.locator('.ai-error').allTextContents());await page.locator('.ai-result').waitFor();
  assert.equal(await page.evaluate(()=>globalThis.__modelCalls),3);assert.ok(await page.locator('[data-ai-proposal]').count()>=1);
  const previous=await notes(page);await page.locator('#generateLocalAI').click();await page.locator('#cancelAIGeneration').click();assert.deepEqual(await notes(page),previous);
});
