import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
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
        "scratch-worklet": "src/scratch-worklet.ts",
      },
      output: {
        entryFileNames: (chunk) =>
          ["core", "audio", "scratch-worklet"].includes(chunk.name)
            ? "[name].js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  server: { host: "0.0.0.0", port: 4173, strictPort: true },
});
