type Cell = string | number | null | undefined;

const encoder = new TextEncoder();

function xml(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let name = "";
  for (let value = index + 1; value; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ name: string; content: string }>) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const write = (size: number, entries: Array<[number, number]>) => {
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);
    entries.forEach(([position, value]) =>
      view.setUint32(position, value, true),
    );
    return bytes;
  };
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const header = write(30, [
      [0, 0x04034b50],
      [14, checksum],
      [18, data.length],
      [22, data.length],
    ]);
    new DataView(header.buffer).setUint16(4, 20, true);
    new DataView(header.buffer).setUint16(26, name.length, true);
    localParts.push(header, name, data);
    const central = write(46, [
      [0, 0x02014b50],
      [16, checksum],
      [20, data.length],
      [24, data.length],
      [42, offset],
    ]);
    const centralView = new DataView(central.buffer);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(28, name.length, true);
    centralParts.push(central, name);
    offset += header.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, offset, true);
  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return new Blob([output.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function createXlsx(
  title: string,
  subtitle: string,
  columns: string[],
  rows: Array<Record<string, Cell>>,
) {
  const safeTitle = xml(title);
  const allRows: Cell[][] = [
    [title],
    [subtitle],
    [],
    columns,
    ...rows.map((row) => columns.map((column) => row[column])),
  ];
  const sheetRows = allRows
    .map((cells, rowIndex) => {
      const cellsXml = cells
        .map((value, columnIndex) => {
          if (value === undefined || value === null || value === "") return "";
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          return typeof value === "number" && Number.isFinite(value)
            ? `<c r="${reference}"><v>${value}</v></c>`
            : `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
    })
    .join("");
  const widths = columns
    .map((column, index) => {
      const longest = Math.max(
        column.length,
        ...rows.slice(0, 100).map((row) => String(row[column] ?? "").length),
      );
      return `<col min="${index + 1}" max="${index + 1}" width="${Math.min(42, Math.max(12, longest + 2))}" customWidth="1"/>`;
    })
    .join("");
  return zip([
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeTitle.slice(0, 31) || "Report"}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A4:${columnName(Math.max(columns.length - 1, 0))}${Math.max(rows.length + 4, 4)}"/></worksheet>`,
    },
  ]);
}
