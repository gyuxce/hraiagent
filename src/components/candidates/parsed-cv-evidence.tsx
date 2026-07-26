"use client";

import { useState } from "react";

type Props = {
  data: Record<string, unknown> | null;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is string => typeof s === "string" && Boolean(s.trim())
  );
}

function parseExperienceLine(line: string): { company: string; detail: string } {
  const parts = line.split(/\s[-–—]\s/);
  if (parts.length >= 2) {
    return {
      company: parts[0].trim(),
      detail: parts.slice(1).join(" · ").trim(),
    };
  }
  return { company: line.trim(), detail: "" };
}

export function ParsedCvEvidence({ data }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!data) {
    return (
      <section className="border-b border-line py-8">
        <p className="page-kicker">Bukti CV</p>
        <h2 className="mt-1 font-display text-xl font-bold text-ink">
          Data parsed
        </h2>
        <p className="mt-3 text-sm text-muted">Tidak ada data parsed.</p>
      </section>
    );
  }

  const skills = asStringList(data.skills);
  const experience = asStringList(data.experience);
  const education = asStringList(data.education);
  const summary =
    typeof data.summary === "string" && data.summary.trim()
      ? data.summary.trim()
      : null;

  const skillPreview = skills.slice(0, 5);
  const skillRest = skills.length - skillPreview.length;
  const expPreview = experience.slice(0, 3);
  const expRest = experience.length - expPreview.length;

  return (
    <section className="border-b border-line py-8">
      <p className="page-kicker">Bukti CV</p>
      <h2 className="mt-1 font-display text-xl font-bold text-ink">
        Ringkas untuk keputusan
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Skill teratas dan pengalaman terbaru. Detail penuh tersedia jika perlu
        dicek ulang.
      </p>

      {skillPreview.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Skills
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skillPreview.map((s) => (
              <span
                key={s}
                className="rounded-md bg-mist px-2 py-0.5 text-xs font-medium text-ink-soft"
              >
                {s}
              </span>
            ))}
            {skillRest > 0 && !expanded && (
              <span className="rounded-md px-2 py-0.5 text-xs text-muted">
                +{skillRest}
              </span>
            )}
          </div>
        </div>
      )}

      {expPreview.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Pengalaman terbaru
          </p>
          <ul className="mt-2 space-y-3">
            {expPreview.map((line) => {
              const { company, detail } = parseExperienceLine(line);
              return (
                <li key={line} className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{company}</p>
                  {detail && (
                    <p className="prose-read mt-0.5 text-ink-soft">{detail}</p>
                  )}
                </li>
              );
            })}
          </ul>
          {expRest > 0 && !expanded && (
            <p className="mt-2 text-xs text-muted">
              +{expRest} pengalaman lainnya
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-5 text-sm font-semibold text-accent hover:text-accent-hover"
      >
        {expanded ? "Sembunyikan CV lengkap" : "Lihat semua data CV"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-5 border-t border-line pt-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Nama</p>
              <p className="text-ink">{String(data.name || "—")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Email</p>
              <p className="break-words text-ink">{String(data.email || "—")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted">Telepon</p>
              <p className="text-ink">{String(data.phone || "—")}</p>
            </div>
          </div>

          {summary && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted">
                Ringkasan
              </p>
              <p className="prose-read mt-1 text-ink-soft">{summary}</p>
            </div>
          )}

          {skills.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                Semua skills
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-mist px-2 py-0.5 text-xs font-medium text-ink-soft"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {experience.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                Semua pengalaman
              </p>
              <ul className="space-y-3">
                {experience.map((line) => {
                  const { company, detail } = parseExperienceLine(line);
                  return (
                    <li key={line}>
                      <p className="font-semibold text-ink">{company}</p>
                      {detail && (
                        <p className="prose-read mt-0.5 text-ink-soft">
                          {detail}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {education.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted">
                Pendidikan
              </p>
              <ul className="prose-read list-disc space-y-1.5 pl-5 text-ink-soft">
                {education.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
