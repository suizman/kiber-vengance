import type { ScoreDocument } from "./model";
export function parseScoreFile(
  file: Blob,
  name: string,
  signal: AbortSignal,
): Promise<ScoreDocument> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./parse-worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      finish();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error(
          "Score parsing exceeded 60 seconds. Split the score and retry.",
        ),
      );
    }, 60_000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = ({
      data,
    }: MessageEvent<{ result?: ScoreDocument; error?: string }>) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else if (data.result) resolve(data.result);
      else reject(new Error("Invalid score parser response"));
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "Score parser failed"));
    };
    void file.arrayBuffer().then(
      (bytes) => {
        if (signal.aborted) cancel();
        else worker.postMessage({ id: 1, bytes, name }, [bytes]);
      },
      (error) => {
        finish();
        reject(error);
      },
    );
  });
}
