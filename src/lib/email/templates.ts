import { BRAND } from "@/lib/brand";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(params: { heading: string; bodyHtml: string; ctaLabel: string; ctaUrl: string; footerNote: string }): string {
  const { heading, bodyHtml, ctaLabel, ctaUrl, footerNote } = params;
  return `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
        <p style="margin:0 0 24px;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#1f5fbf;">${escapeHtml(BRAND.name)}</p>
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">${heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#3f3f46;">${bodyHtml}</div>
        <p style="margin:28px 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:#1f5fbf;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${ctaLabel}</a>
        </p>
        <p style="margin:0;font-size:12px;color:#71717a;word-break:break-all;">
          Kalau tombol tidak berfungsi, salin link ini:<br/>
          <a href="${ctaUrl}" style="color:#71717a;">${ctaUrl}</a>
        </p>
      </div>
      <p style="margin:16px 4px 0;font-size:11px;color:#a1a1aa;">${footerNote}</p>
    </div>
  </body>
</html>`;
}

const ROLE_LABEL: Record<string, string> = {
  admin_agency: "Admin Agency",
  recruiter: "Recruiter",
  client_viewer: "Client Viewer (read-only)",
};

export function teamInviteEmail(params: {
  agencyName: string;
  role: string;
  inviteUrl: string;
}): { subject: string; html: string; text: string } {
  const agency = escapeHtml(params.agencyName);
  const roleLabel = ROLE_LABEL[params.role] || params.role;
  const subject = `Undangan bergabung ke ${params.agencyName} di ${BRAND.name}`;
  const html = layout({
    heading: `Anda diundang ke ${agency}`,
    bodyHtml: `
      <p style="margin:0 0 8px;">${agency} mengundang Anda bergabung sebagai <strong>${escapeHtml(roleLabel)}</strong> di ${escapeHtml(BRAND.name)} — platform rekrutmen berbasis AI.</p>
      <p style="margin:0;">Klik tombol di bawah untuk membuat akun dan langsung masuk ke workspace agency.</p>
    `,
    ctaLabel: "Terima Undangan",
    ctaUrl: params.inviteUrl,
    footerNote: `Link undangan ini berlaku 7 hari dan hanya bisa dipakai sekali. Abaikan email ini jika Anda tidak merasa mendaftar.`,
  });
  const text = `${params.agencyName} mengundang Anda sebagai ${roleLabel} di ${BRAND.name}. Buka: ${params.inviteUrl}`;
  return { subject, html, text };
}

export function scheduleInviteEmail(params: {
  candidateName: string;
  title: string;
  jobTitle: string;
  agencyName: string;
  startAt: Date;
  durationMinutes: number;
  meetingUrl?: string | null;
  location?: string | null;
  googleUrl: string;
  outlookUrl: string;
}): { subject: string; html: string; text: string } {
  const candidate = escapeHtml(params.candidateName);
  const when = params.startAt.toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const place = params.meetingUrl || params.location || null;
  const subject = `Undangan interview: ${params.title} — ${when} WIB`;
  const html = layout({
    heading: `Halo ${candidate}, jadwal interview Anda`,
    bodyHtml: `
      <p style="margin:0 0 8px;">${escapeHtml(params.agencyName)} menjadwalkan interview <strong>${escapeHtml(params.title)}</strong> untuk posisi <strong>${escapeHtml(params.jobTitle)}</strong>.</p>
      <table style="margin:12px 0;font-size:14px;color:#3f3f46;">
        <tr><td style="padding:2px 16px 2px 0;color:#71717a;">Waktu</td><td><strong>${escapeHtml(when)} WIB</strong> (${params.durationMinutes} menit)</td></tr>
        ${place ? `<tr><td style="padding:2px 16px 2px 0;color:#71717a;">Lokasi</td><td>${params.meetingUrl ? `<a href="${params.meetingUrl}">${escapeHtml(params.meetingUrl)}</a>` : escapeHtml(place)}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 4px;font-size:13px;">Simpan ke kalender Anda:</p>
      <p style="margin:0;font-size:13px;">
        <a href="${params.googleUrl}" style="color:#18181b;font-weight:600;">Google Calendar</a>
        &nbsp;·&nbsp;
        <a href="${params.outlookUrl}" style="color:#18181b;font-weight:600;">Outlook</a>
        &nbsp;·&nbsp; file <strong>.ics</strong> terlampir untuk aplikasi kalender lain
      </p>
    `,
    ctaLabel: params.meetingUrl ? "Buka Link Meeting" : "Tambah ke Google Calendar",
    ctaUrl: params.meetingUrl || params.googleUrl,
    footerNote: `Jika jadwal bentrok atau Anda berhalangan, balas email ini atau hubungi ${params.agencyName}.`,
  });
  const text = `Halo ${params.candidateName}, interview "${params.title}" (${params.jobTitle}) dijadwalkan ${when} WIB selama ${params.durationMinutes} menit.${place ? ` Lokasi: ${place}.` : ""} Tambah ke Google Calendar: ${params.googleUrl}`;
  return { subject, html, text };
}

export function interviewInviteEmail(params: {
  candidateName: string;
  jobTitle: string;
  agencyName: string;
  inviteUrl: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  const candidate = escapeHtml(params.candidateName);
  const job = escapeHtml(params.jobTitle);
  const agency = escapeHtml(params.agencyName);
  const expiry = params.expiresAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const subject = `Undangan video interview untuk posisi ${params.jobTitle}`;
  const html = layout({
    heading: `Halo ${candidate}, Anda diundang interview`,
    bodyHtml: `
      <p style="margin:0 0 8px;">${agency} mengundang Anda untuk <strong>video interview async</strong> posisi <strong>${job}</strong>.</p>
      <p style="margin:0 0 8px;">Caranya mudah: jawab beberapa pertanyaan lewat kamera browser Anda, kapan saja sebelum <strong>${expiry}</strong>. Tidak perlu install aplikasi.</p>
      <p style="margin:0;color:#71717a;font-size:13px;">Siapkan kamera &amp; mikrofon, tempat yang tenang, dan koneksi stabil. Durasi sekitar 10–15 menit.</p>
    `,
    ctaLabel: "Mulai Interview",
    ctaUrl: params.inviteUrl,
    footerNote: `Link ini bersifat pribadi dan berlaku sampai ${expiry}. Jangan bagikan ke orang lain.`,
  });
  const text = `Halo ${params.candidateName}, ${params.agencyName} mengundang Anda video interview untuk posisi ${params.jobTitle}. Mulai sebelum ${expiry}: ${params.inviteUrl}`;
  return { subject, html, text };
}
