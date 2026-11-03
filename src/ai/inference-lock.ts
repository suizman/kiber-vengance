let owner: string | null = null;
const residents = new Map<string, () => void>();
const listeners = new Set<(kind: string) => void>();
export function registerInferenceResource(kind: string, release: () => void) {
  residents.set(kind, release);
}
export function onInferenceEvicted(listener: (kind: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function acquireInference(label: string): () => void {
  if (owner) throw new Error(`Local inference busy: ${owner}`);
  owner = label;
  const kind = label.split(" ")[0];
  try {
    for (const [other, release] of residents)
      if (other !== kind) {
        release();
        for (const listener of listeners) listener(other);
      }
  } catch (error) {
    owner = null;
    throw error;
  }
  return () => {
    if (owner === label) owner = null;
  };
}
