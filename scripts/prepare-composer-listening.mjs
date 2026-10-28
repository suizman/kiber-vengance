// Prepare blinded compiler comparisons. Authored plans, not claimed model output.
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { transformWithOxc } from "vite";
import { launchBrowser, preview } from "../tests/browser-support.js";
import { createEmptyProject, activeClip } from "../dist/core.js";
import { composeMelody, DEFAULT_COMPOSITION } from "../dist/composer.js";
const revision =
  process.env.COMPOSER_BASELINE ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const source = execFileSync("git", ["show", `${revision}:src/ai/composer.ts`], {
  encoding: "utf8",
}).replace(
  '"../core"',
  JSON.stringify(new URL("../dist/core.js", import.meta.url).href),
);
const compiled = (await transformWithOxc(source, "baseline-composer.ts")).code;
const old = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const cases = [
  {
    name: "electro-rock",
    motif: [0, 7, 0, 4, 0, 7, 5, 4],
    rhythm: "driving",
    contour: "repeat",
    articulation: "short",
  },
  {
    name: "cinematic",
    motif: [0, 2, 4, 7, 9, 7, 4, 0],
    rhythm: "sparse",
    contour: "arch",
    articulation: "sustained",
  },
  {
    name: "synthwave",
    motif: [0, 4, 7, 9, 7, 5, 4, 0],
    rhythm: "syncopated",
    contour: "rise",
    articulation: "short",
  },
];
const destination = "/private/tmp/kiber-composer-listening";
await mkdir(destination, { recursive: true });
const server = preview(Number(process.env.LISTENING_PORT) || 4268);
let browser;
try {
  await server.ready();
  browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(`${server.url}/?qa=1`, { waitUntil: "networkidle" });
  const key = [];
  for (const [index, item] of cases.entries()) {
    const project = createEmptyProject(),
      clip = activeClip(project, "lead"),
      target = {
        projectId: project.id,
        clipId: clip.id,
        track: "lead",
        key: project.key,
        scale: project.scale,
        stepsPerBar: 16,
        tempo: project.tempo,
      };
    const plan = { ...item, title: item.name, energy: 0.8 },
      options = {
        ...DEFAULT_COMPOSITION,
        context: false,
        maxLeap: 12,
        variation: 60,
      };
    const candidates = [
      {
        implementation: "before",
        notes: old.composeMelody(plan, target, 4, options, 7),
      },
      {
        implementation: "after",
        notes: composeMelody(plan, target, 4, options, 7),
      },
    ];
    if (index % 2) candidates.reverse();
    for (const [variant, candidate] of candidates.entries()) {
      clip.bars = 4;
      clip.notes = candidate.notes;
      const bytes = await page.evaluate(async (project) => {
        const { renderWav } = await import("/audio.js");
        const wav = await renderWav(project, {
          song: false,
          dry: true,
          normalize: true,
          tailSeconds: 0,
        });
        return [...new Uint8Array(await wav.arrayBuffer())];
      }, project);
      const filename = `${item.name}-${variant ? "B" : "A"}.wav`;
      await writeFile(`${destination}/${filename}`, Buffer.from(bytes));
      key.push({ file: filename, implementation: candidate.implementation });
    }
  }
  await writeFile(
    `${destination}/comparison-key.json`,
    JSON.stringify(
      {
        baseline: `${revision}:src/ai/composer.ts`,
        note: "Authored identical plans, same seed/settings/synth, dry normalized audio. No genuine inference or preference result is implied.",
        pairs: key,
      },
      null,
      2,
    ),
  );
  console.log("Blinded comparison WAVs written:", destination);
} finally {
  await browser?.close();
  server.close();
}
