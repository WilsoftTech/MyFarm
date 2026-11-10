import { inflateRawSync } from "node:zlib";
import { crc32 } from "../../src/modules/farm-export/domain/zip";

/** An independent ZIP reader for tests: walks the central directory as unzip tools do and checks every entry's CRC. */
export function readZip(bytes: Uint8Array): Map<string, string> {
  const fail = (what: string) => { throw new Error("Bad ZIP: " + what); };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength - 22;
  if (view.getUint32(end, true) !== 0x06054b50) fail("no end record");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) fail("central record");
    const method = view.getUint16(at + 10, true), crc = view.getUint32(at + 16, true), packed = view.getUint32(at + 20, true), size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true), local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (view.getUint32(local, true) !== 0x04034b50) fail("local record");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const body = bytes.subarray(start, start + packed);
    const data = method === 8 ? new Uint8Array(inflateRawSync(body)) : method === 0 ? body : fail("method");
    if (data.byteLength !== size || crc32(data) !== crc) fail("size or CRC of " + name);
    files.set(name, new TextDecoder("utf-8", { ignoreBOM: true }).decode(data));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}
