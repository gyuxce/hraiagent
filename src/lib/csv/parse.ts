export type CsvRow = Record<string, string>;

/** Minimal CSV parser (supports quotes + commas). */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_")
  );

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = (cells[idx] || "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function normalizeHeaderAliases(row: CsvRow): {
  name: string;
  email: string;
  phone: string;
  job: string;
  status: string;
} {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const v = row[key];
      if (v) return v;
    }
    return "";
  };

  return {
    name: get("name", "nama", "candidate_name", "full_name", "nama_lengkap"),
    email: get("email", "e-mail", "mail"),
    phone: get("phone", "telepon", "no_hp", "hp", "mobile", "whatsapp"),
    job: get(
      "job",
      "job_title",
      "posisi",
      "position",
      "lowongan",
      "job_name",
      "title"
    ),
    status: get("status", "pipeline_status"),
  };
}
