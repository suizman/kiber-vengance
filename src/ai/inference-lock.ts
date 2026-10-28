let owner: string | null = null;
export function acquireInference(label: string): () => void {
  if (owner) throw new Error(`Local inference busy: ${owner}`);
  owner = label;
  return () => {
    if (owner === label) owner = null;
  };
}
