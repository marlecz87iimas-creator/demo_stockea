export type ExcelCell = string | number | null | undefined;

export interface ExcelSheet {
  name: string;
  rows: ExcelCell[][];
}

function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u202F\u2007\u2009]/g, ' ')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'");
}

function escapeXml(value: string): string {
  return sanitizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sheetName(name: string): string {
  return sanitizeText(name).replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31) || 'Hoja';
}

function normalizeRows(rows: ExcelCell[][]): ExcelCell[][] {
  return rows.map((row) => (row.length === 0 ? [''] : row));
}

function colName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(value: ExcelCell, ref: string): string {
  if (value == null || value === '') {
    return `<c r="${ref}"/>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const text = escapeXml(String(value));
  return `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
}

function worksheetXml(rows: ExcelCell[][]): string {
  const normalized = normalizeRows(rows);
  const sheetData = normalized.map((row, rIdx) => {
    const cells = row.map((value, cIdx) => cellXml(value, `${colName(cIdx)}${rIdx + 1}`)).join('');
    return `<row r="${rIdx + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetData>${sheetData}</sheetData>
</worksheet>`;
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${overrides}
</Types>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(sheets: ExcelSheet[]): string {
  const sheetNodes = sheets.map((sheet, i) =>
    `<sheet name="${escapeXml(sheetName(sheet.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetNodes}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}
</Relationships>`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Build a ZIP archive using STORE (no compression). Excel accepts this for .xlsx. */
function zipStore(files: { path: string; data: Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encodeUtf8(file.path);
    const crc = crc32(file.data);
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0), // STORE
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, file.data);

    const centralHeader = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }

  const centralDir = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concatBytes([...localParts, centralDir, end]);
}

export function buildExcelXlsx(sheets: ExcelSheet[]): Uint8Array {
  const usable = sheets.filter((s) => s.rows.some((r) => r.some((c) => c != null && c !== '')));
  const list = usable.length ? usable : [{ name: 'Hoja1', rows: [['Sin datos']] }];

  const files: { path: string; data: Uint8Array }[] = [
    { path: '[Content_Types].xml', data: encodeUtf8(contentTypesXml(list.length)) },
    { path: '_rels/.rels', data: encodeUtf8(rootRelsXml()) },
    { path: 'xl/workbook.xml', data: encodeUtf8(workbookXml(list)) },
    { path: 'xl/_rels/workbook.xml.rels', data: encodeUtf8(workbookRelsXml(list.length)) },
  ];

  list.forEach((sheet, i) => {
    files.push({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      data: encodeUtf8(worksheetXml(sheet.rows)),
    });
  });

  return zipStore(files);
}

/** @deprecated Kept for tests/callers that expected XML; prefer buildExcelXlsx. */
export function buildExcelXml(sheets: ExcelSheet[]): string {
  // Fallback textual representation is unused for downloads now.
  return sheets.map((s) => s.name).join(',');
}

export function downloadExcel(filename: string, sheets: ExcelSheet[]): void {
  if (!sheets.length || sheets.every((s) => normalizeRows(s.rows).every((r) => r.every((c) => c == null || c === '')))) {
    throw new Error('El reporte no tiene datos para exportar');
  }

  const bytes = buildExcelXlsx(sheets);
  const blob = new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const base = filename.replace(/\.xlsx?$/i, '');
  a.download = `${base}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** ASCII date/time for Excel cells (avoids locale blanks). */
export function excelDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
