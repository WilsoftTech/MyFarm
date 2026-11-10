/**
 * A minimal ZIP writer for the farm export (D-P09-013), so the farmer gets one file that phones and computers open
 * without extra apps, and MyFarm needs no new package. Entries are stored, or deflated when the caller passes a raw
 * DEFLATE function (Node's zlib on the server). Files are UTF-8 named; the classic format's 4 GB limit is checked.
 */
export interface ZipEntry { name: string; data: Uint8Array }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, in UTC, as ZIP stores them (two-second precision, years 1980 to 2107). */
function dosDateTime(at: Date): { date: number; time: number } {
  const year = Math.min(Math.max(at.getUTCFullYear(), 1980), 2107);
  return {
    date: ((year - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate(),
    time: (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | Math.floor(at.getUTCSeconds() / 2),
  };
}

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const LIMIT = 0xffffffff;

export type Deflate = (data: Uint8Array) => Uint8Array;

export function zip(entries: readonly ZipEntry[], at: Date, deflate?: Deflate): Uint8Array {
  const names = new Set<string>();
  for (const entry of entries) {
    if (!SAFE_NAME.test(entry.name) || names.has(entry.name)) throw new Error("Invalid ZIP entry name");
    names.add(entry.name);
  }
  const encoder = new TextEncoder();
  const { date, time } = dosDateTime(at);
  const local: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), crc = crc32(entry.data), size = entry.data.byteLength;
    const packed = deflate ? deflate(entry.data) : null;
    // Keep an entry stored when deflating would not make it smaller.
    const method = packed && packed.byteLength < size ? 8 : 0, body = method === 8 && packed ? packed : entry.data, stored = body.byteLength;
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true); header.setUint16(4, 20, true); header.setUint16(6, 0x0800, true); header.setUint16(8, method, true);
    header.setUint16(10, time, true); header.setUint16(12, date, true); header.setUint32(14, crc, true);
    header.setUint32(18, stored, true); header.setUint32(22, size, true); header.setUint16(26, name.byteLength, true); header.setUint16(28, 0, true);
    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true); record.setUint16(4, 20, true); record.setUint16(6, 20, true); record.setUint16(8, 0x0800, true); record.setUint16(10, method, true);
    record.setUint16(12, time, true); record.setUint16(14, date, true); record.setUint32(16, crc, true);
    record.setUint32(20, stored, true); record.setUint32(24, size, true); record.setUint16(28, name.byteLength, true);
    record.setUint16(30, 0, true); record.setUint16(32, 0, true); record.setUint16(34, 0, true); record.setUint16(36, 0, true);
    record.setUint32(38, 0, true); record.setUint32(42, offset, true);
    if (size > LIMIT) throw new Error("ZIP too large");
    local.push(new Uint8Array(header.buffer), name, body);
    central.push(new Uint8Array(record.buffer), name);
    offset += 30 + name.byteLength + stored;
    if (offset > LIMIT) throw new Error("ZIP too large");
  }
  const centralSize = central.reduce((total, part) => total + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let position = 0;
  for (const part of parts) { out.set(part, position); position += part.byteLength; }
  return out;
}
