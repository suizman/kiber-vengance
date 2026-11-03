export interface Change {
  path: string[];
  before: unknown;
  after: unknown;
  existedBefore: boolean;
  existsAfter: boolean;
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

/** Project data is JSON-shaped. Only changed values survive in the undo journal. */
export function changesBetween(
  before: unknown,
  after: unknown,
  path: string[] = [],
  output: Change[] = [],
): Change[] {
  if (Object.is(before, after)) return output;
  if (
    object(before) &&
    object(after) &&
    Array.isArray(before) === Array.isArray(after) &&
    (!Array.isArray(before) ||
      (Array.isArray(after) && before.length === after.length))
  ) {
    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      const existedBefore = Object.hasOwn(before, key),
        existsAfter = Object.hasOwn(after, key);
      if (existedBefore && existsAfter)
        changesBetween(before[key], after[key], [...path, key], output);
      else
        output.push({
          path: [...path, key],
          before: structuredClone(before[key]),
          after: structuredClone(after[key]),
          existedBefore,
          existsAfter,
        });
    }
  } else
    output.push({
      path,
      before: structuredClone(before),
      after: structuredClone(after),
      existedBefore: true,
      existsAfter: true,
    });
  return output;
}

export function applyChanges<T>(
  input: T,
  changes: readonly Change[],
  direction: "before" | "after",
): T {
  let result = structuredClone(input);
  for (const change of changes) {
    if (!change.path.length) {
      result = structuredClone(change[direction]) as T;
      continue;
    }
    let parent = result as Record<string, unknown>;
    for (const key of change.path.slice(0, -1)) {
      if (
        ["__proto__", "constructor", "prototype"].includes(key) ||
        !object(parent[key])
      )
        throw new Error("Invalid history path");
      parent = parent[key] as Record<string, unknown>;
    }
    const key = change.path.at(-1)!;
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("Invalid history key");
    if (direction === "before" ? change.existedBefore : change.existsAfter)
      parent[key] = structuredClone(change[direction]);
    else delete parent[key];
  }
  return result;
}

export class History<T> {
  readonly past: Change[][] = [];
  readonly future: Change[][] = [];
  private pending: T | undefined;
  constructor(readonly limit = 60) {}
  push(value: T): void {
    this.finish(value);
    this.pending = structuredClone(value);
    this.future.length = 0;
  }
  finish(current: T): void {
    if (this.pending === undefined) return;
    const changes = changesBetween(this.pending, current);
    this.pending = undefined;
    if (changes.length) {
      this.past.push(changes);
      if (this.past.length > this.limit) this.past.shift();
    }
  }
  undo(current: T): T {
    this.finish(current);
    const changes = this.past.pop();
    if (!changes) return current;
    this.future.push(changes);
    return applyChanges(current, changes, "before");
  }
  redo(current: T): T {
    this.finish(current);
    const changes = this.future.pop();
    if (!changes) return current;
    this.past.push(changes);
    return applyChanges(current, changes, "after");
  }
}
