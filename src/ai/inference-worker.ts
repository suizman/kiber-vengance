import {
  MLCEngine,
  prebuiltAppConfig,
  deleteModelAllInfoInCache,
} from "@mlc-ai/web-llm";
import { melodySchema } from "./melody";

const scope = globalThis as unknown as {
  postMessage(value: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};
let engine: MLCEngine | null = null;
scope.onmessage = async (event: MessageEvent) => {
  const { kind, model, prompt, key, scale, bars } = event.data;
  try {
    if (kind === "probe") {
      const gpu = (
        globalThis.navigator as Navigator & {
          gpu?: { requestAdapter(): Promise<unknown> };
        }
      ).gpu;
      scope.postMessage({
        kind: "probed",
        supported: !!(await gpu?.requestAdapter()),
      });
    } else if (kind === "delete") {
      for (const id of event.data.models) await deleteModelAllInfoInCache(id);
      scope.postMessage({ kind: "deleted" });
    } else if (kind === "load") {
      const record = prebuiltAppConfig.model_list.find(
        (item) => item.model_id === model,
      );
      if (!record) throw new Error("Local model unavailable in this runtime.");
      engine = new MLCEngine({
        appConfig: { ...prebuiltAppConfig, model_list: [record] },
        initProgressCallback: (progress) =>
          scope.postMessage({
            kind: "progress",
            progress: progress.progress,
            text: progress.text,
          }),
      });
      await engine.reload(model, { context_window_size: 2048 });
      scope.postMessage({ kind: "loaded" });
    } else if (kind === "generate" && engine) {
      await engine.resetChat();
      const response = await engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You design short melodic motifs for a music sequencer. Interpret English or Spanish requests. Return only the JSON musical plan. motif contains 4 to 8 SCALE DEGREES (integers 0 to 14), not MIDI pitches. 0 is tonic; 2 is third; 4 is fifth; 7 is upper tonic. Choose varied, musical motifs appropriate to the request. rhythm is sparse, steady, driving or syncopated. contour is repeat, rise, fall or arch. articulation is short or sustained. energy is 0 to 1. Give a short evocative title. /no_think",
          },
          {
            role: "user",
            content: `${prompt}\nUse ${bars} bars in ${key} ${scale}. /no_think`,
          },
        ],
        response_format: {
          type: "json_object",
          schema: JSON.stringify(melodySchema),
        },
        extra_body: { enable_thinking: false },
        temperature: 0.8,
        top_p: 0.85,
        max_tokens: 256,
      });
      const text = response.choices[0]?.message.content;
      if (response.choices[0]?.finish_reason === "length" || !text)
        throw new Error(
          "The model did not finish a musical plan. Try a shorter prompt.",
        );
      scope.postMessage({ kind: "result", text, usage: response.usage });
    } else throw new Error("Load the local model first.");
  } catch (error) {
    scope.postMessage({
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
