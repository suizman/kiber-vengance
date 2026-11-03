/** Read dimensions before decoding a potentially enormous phone photograph. */
export function scoreImageSize(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a
  )
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let position = 2;
    while (position + 4 < bytes.length) {
      if (bytes[position++] !== 0xff) break;
      while (bytes[position] === 0xff) position++;
      const marker = bytes[position++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker! >= 0xd0 && marker! <= 0xd7)) continue;
      const length = view.getUint16(position);
      if (length < 2 || position + length > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker!) &&
        length >= 7
      )
        return {
          height: view.getUint16(position + 3),
          width: view.getUint16(position + 5),
        };
      position += length;
    }
  }
  throw new Error(
    "Cannot read image dimensions. Export this page as a smaller PNG or JPEG.",
  );
}
