import { parseStructured } from "./structured";
import { parseMidiScore } from "./midi";
import { parseAbcScore } from "./abc";
import { SCORE_LIMITS, validateScore } from "./model";
export { validateScore } from "./model";
export function parseScore(bytes: Uint8Array, name: string) {
  if (bytes.byteLength > SCORE_LIMITS.bytes)
    throw new Error(
      "Structured scores are limited to 32 MiB. Split this file into sections.",
    );
  const header = new TextDecoder().decode(bytes.subarray(0, 4));
  return validateScore(
    header === "MThd"
      ? parseMidiScore(bytes, name)
      : /\.abc$/i.test(name)
        ? parseAbcScore(new TextDecoder().decode(bytes), name)
        : parseStructured(bytes, name),
  );
}
export { insertScore } from "./insert";
export { scoreMusicXml } from "./musicxml";
