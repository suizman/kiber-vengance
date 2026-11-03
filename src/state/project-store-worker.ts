import type { Project } from "../model";
import type { SavedVersion } from "./project-repository";

let database: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  return (database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("kiber-vengance-state-v7", 1);
    request.onupgradeneeded = () => {
      for (const name of ["current", "versions", "version-index", "metadata"])
        request.result.createObjectStore(name);
    };
    request.onerror = () =>
      reject(request.error || new Error("Cannot open project storage"));
    request.onblocked = () =>
      reject(
        new Error(
          "Project database upgrade is blocked by another open tab. Close the older tab and reload.",
        ),
      );
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  }));
}
function read<T>(
  db: IDBDatabase,
  store: string,
  key: IDBValidKey,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
function commit(
  db: IDBDatabase,
  stores: string[],
  write: (tx: IDBTransaction) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(tx.error || new Error("Project save aborted"));
    write(tx);
  });
}
async function versions(db: IDBDatabase): Promise<SavedVersion[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("version-index")
      .objectStore("version-index")
      .getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as SavedVersion[]).sort((a, b) => b.date - a.date),
      );
    request.onerror = () => reject(request.error);
  });
}
async function saveVersion(
  db: IDBDatabase,
  item: SavedVersion & { project: Project },
) {
  const existing = await versions(db);
  const { project, ...info } = item;
  await commit(db, ["versions", "version-index"], (tx) => {
    tx.objectStore("versions").put(project, info.id);
    tx.objectStore("version-index").put(info, info.id);
    for (const old of existing.slice(19)) {
      tx.objectStore("versions").delete(old.id);
      tx.objectStore("version-index").delete(old.id);
    }
  });
}
interface StoreMessage {
  id: number;
  action: string;
  payload: unknown;
}
async function handle({ action, payload }: StoreMessage): Promise<unknown> {
  const db = await open();
  switch (action) {
    case "load":
      return read(db, "current", "studio");
    case "quarantine": {
      const original = await read(db, "current", "studio");
      if (original)
        await commit(db, ["metadata"], (tx) =>
          tx.objectStore("metadata").put(original, `unreadable-${Date.now()}`),
        );
      return;
    }
    case "save":
      return commit(db, ["current"], (tx) =>
        tx.objectStore("current").put(payload, "studio"),
      );
    case "list-versions":
      return versions(db);
    case "get-version":
      return read(db, "versions", String(payload));
    case "save-version":
      return saveVersion(db, payload as SavedVersion & { project: Project });
    case "delete-version":
      return commit(db, ["versions", "version-index"], (tx) => {
        tx.objectStore("versions").delete(String(payload));
        tx.objectStore("version-index").delete(String(payload));
      });
    case "import-versions": {
      if (await read(db, "metadata", "legacy-versions")) return;
      const input: unknown = JSON.parse(String(payload));
      if (!Array.isArray(input)) throw new Error("Invalid saved versions");
      for (const item of input.slice(0, 20).reverse())
        if (item?.id && item?.project) await saveVersion(db, item);
      return commit(db, ["metadata"], (tx) =>
        tx.objectStore("metadata").put(true, "legacy-versions"),
      );
    }
    default:
      throw new Error("Unknown project storage request");
  }
}
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<StoreMessage>) => {
  queue = queue.then(async () => {
    try {
      self.postMessage({ id: data.id, result: await handle(data) });
    } catch (error) {
      self.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
