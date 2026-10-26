/** Paint range values without changing their native input/keyboard behaviour. */
export function setupControlFeedback() {
  const paint = (range: HTMLInputElement) => {
    const min = Number(range.min || 0), max = Number(range.max || 100);
    const percent = max > min ? Math.max(0, Math.min(100, (range.valueAsNumber - min) / (max - min) * 100)) : 0;
    range.style.setProperty("--range-fill", `${Number.isFinite(percent) ? percent : 0}%`);
  };
  const refresh = () => document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paint);
  let queued = false;
  const queueRefresh = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; refresh(); });
  };
  for (const type of ["input", "change", "focusin", "pointerover"]) {
    document.addEventListener(type, (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "range") paint(target);
      // Clip/preset changes also update existing range values programmatically.
      if (type === "change") queueRefresh();
    }, true);
  }
  new MutationObserver(queueRefresh).observe(document.querySelector("#app") || document.body, { childList: true, subtree: true });
  refresh();
}
