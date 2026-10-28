/// <reference types="vite/client" />
declare module "@echogarden/espeak-ng-emscripten" {
  const initialize: (options?: Record<string, unknown>) => Promise<{
    eSpeakNGWorker: new () => {
      set_voice(name: string, language: string): number;
      synthesize_ipa(text: string): { code: number; ipa: string };
    };
  }>;
  export default initialize;
}
