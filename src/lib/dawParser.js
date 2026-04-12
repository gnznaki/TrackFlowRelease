import { readFile, readTextFile } from "@tauri-apps/plugin-fs";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ── FL Studio (.flp) ─────────────────────────────────────────────────────────
// FLP is a chunked binary format. Events are: [id byte] + payload.
//   id  0-63  → 1 byte payload
//   id 64-127 → 2 byte payload (little-endian)
//   id 128-191→ 4 byte payload (little-endian)
//   id 192-255→ variable (VarInt length prefix)
// BPM lives at:
//   event 156 (DWORD): "FineTempo" = BPM * 1000  (FL 12+)
//   event  66 (WORD):  legacy integer BPM
function parseFlpBpm(bytes) {
  if (bytes.length < 12) return null;
  // Magic: "FLhd"
  if (bytes[0] !== 0x46 || bytes[1] !== 0x4C || bytes[2] !== 0x68 || bytes[3] !== 0x64) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hdrLen = view.getUint32(4, true);
  let pos = 8 + hdrLen;
  if (pos + 8 > bytes.length) return null;

  // "FLdt" chunk
  if (bytes[pos] !== 0x46 || bytes[pos+1] !== 0x4C || bytes[pos+2] !== 0x64 || bytes[pos+3] !== 0x74) return null;
  pos += 4;
  const dataLen = view.getUint32(pos, true);
  pos += 4;
  const end = Math.min(pos + dataLen, bytes.length);

  let fineTempo = null;
  let oldTempo  = null;

  while (pos < end) {
    const id = bytes[pos++];
    if (id < 64) {
      pos += 1;
    } else if (id < 128) {
      if (id === 66 && pos + 1 < end) oldTempo = view.getUint16(pos, true);
      pos += 2;
    } else if (id < 192) {
      if (id === 156 && pos + 3 < end) fineTempo = view.getUint32(pos, true);
      pos += 4;
    } else {
      // VarInt length prefix
      let size = 0, shift = 0;
      while (pos < end) {
        const b = bytes[pos++];
        size |= (b & 0x7F) << shift;
        shift += 7;
        if (!(b & 0x80)) break;
      }
      pos += size;
    }
  }

  if (fineTempo !== null && fineTempo > 0) return Math.round(fineTempo / 1000);
  if (oldTempo  !== null && oldTempo  > 0) return oldTempo;
  return null;
}

// ── Ableton Live (.als) ───────────────────────────────────────────────────────
// .als files are gzip-compressed XML. BPM and Key (Live 11+) are in the XML.
async function parseAlsData(bytes) {
  let xml;
  try {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let total = 0;
    for (const c of chunks) total += c.length;
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    xml = new TextDecoder().decode(merged);
  } catch {
    return { bpm: null, key: null };
  }

  let bpm = null;
  // <Tempo> ... <Manual Value="128.0" .../>
  const bpmMatch = xml.match(/<Tempo\b[^>]*>[\s\S]{0,400}?<Manual\s+Value="([\d.]+)"/);
  if (bpmMatch) bpm = Math.round(parseFloat(bpmMatch[1]));

  let key = null;
  // Live 11+: <Scale Root="9" Name="minor"/>  (Root 0=C … 11=B)
  const scaleMatch = xml.match(/<Scale\s+Root="(\d+)"\s+Name="([^"]+)"/);
  if (scaleMatch) {
    const root = NOTE_NAMES[parseInt(scaleMatch[1]) % 12];
    key = `${root} ${scaleMatch[2]}`; // e.g. "A minor"
  }

  return { bpm, key };
}

// ── Reaper (.rpp) ─────────────────────────────────────────────────────────────
// Plain text. BPM is on the TEMPO line: "  TEMPO 128 4 4"
function parseRppData(text) {
  let bpm = null;
  const m = text.match(/^\s*TEMPO\s+([\d.]+)/m);
  if (m) bpm = Math.round(parseFloat(m[1]));
  return { bpm, key: null };
}

// ── Public API ────────────────────────────────────────────────────────────────
// Returns { bpm: number|null, key: string|null }
export async function extractDawMeta(path, daw) {
  try {
    if (daw === "fl") {
      const bytes = await readFile(path);
      return { bpm: parseFlpBpm(bytes), key: null };
    }
    if (daw === "ab") {
      const bytes = await readFile(path);
      return await parseAlsData(bytes);
    }
    if (daw === "rp") {
      const text = await readTextFile(path);
      return parseRppData(text);
    }
  } catch { /* file not found, permissions, etc. */ }
  return { bpm: null, key: null };
}
