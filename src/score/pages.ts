import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type PDFDocumentLoadingTask,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { scoreImageSize } from "./image-size";
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
export interface PageCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
  rotation: number;
}
export const fullPage: PageCrop = {
  left: 0,
  top: 0,
  right: 100,
  bottom: 100,
  rotation: 0,
};
export class ScorePages {
  private task: PDFDocumentLoadingTask | undefined;
  private pdf: PDFDocumentProxy | undefined;
  count = 1;
  constructor(private file: File) {}
  async open(signal: AbortSignal) {
    if (/\.pdf$/i.test(this.file.name)) {
      const task = (this.task = getDocument({
        data: new Uint8Array(await this.file.arrayBuffer()),
        useWasm: false,
        standardFontDataUrl: new URL("./pdf-fonts/", document.baseURI).href,
      }));
      const cancel = () => {
        void task.destroy();
      };
      signal.addEventListener("abort", cancel, { once: true });
      try {
        this.pdf = await task.promise;
        this.count = this.pdf.numPages;
      } finally {
        signal.removeEventListener("abort", cancel);
      }
    }
    signal.throwIfAborted();
  }
  async image(
    pageNumber: number,
    crop: PageCrop,
    signal: AbortSignal,
  ): Promise<Blob> {
    signal.throwIfAborted();
    const canvas = document.createElement("canvas"),
      context = canvas.getContext("2d")!;
    try {
      if (this.pdf) {
        const page = await this.pdf.getPage(pageNumber),
          native = page.getViewport({ scale: 1, rotation: crop.rotation });
        const viewport = page.getViewport({
          scale: Math.min(3, 2200 / Math.max(native.width, native.height)),
          rotation: crop.rotation,
        });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const task = page.render({ canvas, canvasContext: context, viewport });
        const cancel = () => task.cancel();
        signal.addEventListener("abort", cancel, { once: true });
        try {
          await task.promise;
        } finally {
          signal.removeEventListener("abort", cancel);
          page.cleanup();
        }
      } else {
        const size = scoreImageSize(
          new Uint8Array(await this.file.slice(0, 1024 * 1024).arrayBuffer()),
        );
        if (
          !size.width ||
          !size.height ||
          size.width * size.height > 24_000_000
        )
          throw new Error(
            "This image is larger than 24 megapixels. Resize it before importing.",
          );
        signal.throwIfAborted();
        const bitmap = await createImageBitmap(this.file);
        try {
          if (bitmap.width * bitmap.height > 24_000_000)
            throw new Error(
              "This image is larger than 24 megapixels. Resize it before importing.",
            );
          const rotated = crop.rotation % 180 !== 0,
            scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
          canvas.width = Math.ceil(
            (rotated ? bitmap.height : bitmap.width) * scale,
          );
          canvas.height = Math.ceil(
            (rotated ? bitmap.width : bitmap.height) * scale,
          );
          context.fillStyle = "white";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate((crop.rotation * Math.PI) / 180);
          context.drawImage(
            bitmap,
            (-bitmap.width * scale) / 2,
            (-bitmap.height * scale) / 2,
            bitmap.width * scale,
            bitmap.height * scale,
          );
        } finally {
          bitmap.close();
        }
      }
      signal.throwIfAborted();
      if (crop.left >= crop.right || crop.top >= crop.bottom)
        throw new Error("The crop must have a positive width and height");
      const result = document.createElement("canvas");
      result.width = Math.max(
        1,
        Math.round((canvas.width * (crop.right - crop.left)) / 100),
      );
      result.height = Math.max(
        1,
        Math.round((canvas.height * (crop.bottom - crop.top)) / 100),
      );
      result
        .getContext("2d")!
        .drawImage(
          canvas,
          (canvas.width * crop.left) / 100,
          (canvas.height * crop.top) / 100,
          result.width,
          result.height,
          0,
          0,
          result.width,
          result.height,
        );
      try {
        return await new Promise<Blob>((resolve, reject) =>
          result.toBlob(
            (blob) =>
              blob
                ? resolve(blob)
                : reject(new Error("Cannot render score page")),
            "image/png",
          ),
        );
      } finally {
        result.width = result.height = 1;
      }
    } finally {
      canvas.width = canvas.height = 1;
    }
  }
  close() {
    void this.task?.destroy();
    this.pdf = undefined;
    this.task = undefined;
  }
}
