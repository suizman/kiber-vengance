/** Consume a large download into storage first: never tee it into an unread clone. */
export async function modelBytes(
  url: string,
  label: string,
  progress: (text: string) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  let cache: Cache | undefined;
  try {
    cache = await caches.open("kv-expressive-model-v1");
    const hit = await cache.match(url);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  } catch {
    cache = undefined;
    progress("Model cache unavailable; continuing online");
  }
  const download = async () => {
    progress(`Downloading ${label}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
    if (!response.body) return response;
    let received = 0,
      last = 0;
    const total = Number(response.headers.get("content-length"));
    const body = response.body.pipeThrough(
      new TransformStream({
        transform(chunk: Uint8Array, controller) {
          received += chunk.byteLength;
          if (received - last >= 4 * 1024 * 1024) {
            last = received;
            const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(0);
            progress(
              `Downloading ${label} · ${mb(received)}${total > 0 ? ` / ${mb(total)}` : ""} MB`,
            );
          }
          controller.enqueue(chunk);
        },
      }),
    );
    return new Response(body, { headers: response.headers });
  };
  let response = await download();
  if (cache) {
    try {
      // Cache.put consumes this response; only then read the persisted body.
      await cache.put(url, response);
      const stored = await cache.match(url);
      if (!stored) throw new Error("Model cache entry missing");
      return new Uint8Array(await stored.arrayBuffer());
    } catch {
      progress("Model cache unavailable; retrying download without storage");
      // A failed put may already have consumed the stream. Do not retain a clone
      // merely to cover quota errors: retry only in that exceptional case.
      response = await download();
    }
  }
  return new Uint8Array(await response.arrayBuffer());
}
