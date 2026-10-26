import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

function sourceCommit() {
  const supplied = process.env.KV_BUILD_COMMIT;
  if (supplied) {
    if (!/^[a-f0-9]{7,40}$/i.test(supplied))
      throw new Error("KV_BUILD_COMMIT must be a Git commit hash");
    return supplied.slice(0, 7);
  }
  try {
    return execFileSync("git", [
      "log", "-1", "--format=%H", "--",
      "src", "public", "scripts", "index.html", "vite.config.ts",
      "package.json", "package-lock.json", "tsconfig.json",
    ], {
      cwd: import.meta.dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().slice(0, 7) || "unknown";
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  base: "./",
  worker: { format: "es" },
  plugins: [{
    name: "source-commit",
    transformIndexHtml: (html) => html.replaceAll("__BUILD_COMMIT__", sourceCommit()),
  }],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        studio: "index.html",
        core: "src/core.ts",
        audio: "src/audio.ts",
        melody: "src/ai/melody.ts",
        presets: "src/ai/presets.ts",
        "scratch-worklet": "src/scratch-worklet.ts",
      },
      output: {
        entryFileNames: (chunk) =>
          ["core", "audio", "melody", "presets", "scratch-worklet"].includes(chunk.name)
            ? "[name].js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  server: { host: "0.0.0.0", port: 4173, strictPort: true },
});
