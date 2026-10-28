// Optional byte-for-byte model mirror for offline/controlled real-inference tests.
// This supplies downloaded weights, never synthetic model outputs.
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { resolve, sep } from "node:path";
export async function routeVoiceDownloads(context) {
  const directory = process.env.VOICE_MODEL_MIRROR;
  if (!directory) return () => {};
  const root = resolve(directory);
  const server = http.createServer((req, res) => {
    const path = resolve(
      root,
      "." + decodeURIComponent((req.url || "/").split("?")[0]),
    );
    if (!path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Content-Length": statSync(path).size,
        "Content-Type": path.endsWith(".json")
          ? "application/json"
          : "application/octet-stream",
      });
      createReadStream(path).pipe(res);
    } catch {
      res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await context.route("https://huggingface.co/**", (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      status: 302,
      headers: {
        location: origin + url.pathname.replace("/resolve/", "/"),
        "access-control-allow-origin": "*",
      },
    });
  });
  await context.route('https://cdn.jsdelivr.net/npm/onnxruntime-web@*/dist/*',route=>{const url=new URL(route.request().url());return route.fulfill({status:302,headers:{location:origin+'/_runtime/'+url.pathname.split('/').at(-1),'access-control-allow-origin':'*'}});});
  return () => server.close();
}
