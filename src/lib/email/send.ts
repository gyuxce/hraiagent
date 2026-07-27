import { BRAND } from "@/lib/brand";

export type SendEmailResult = {
  sent: boolean;
  /** "not_configured" when RESEND_API_KEY is missing — caller should fall back to copy-link UX */
  reason?: "not_configured" | "provider_error";
  error?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Minimal transactional email sender via Resend REST API (no SDK dependency).
 * Never throws — email failure must not break invite creation flows.
 */
export type EmailAttachment = {
  filename: string;
  /** Base64-encoded content (Resend format) */
  content: string;
};

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, reason: "not_configured" };
  }

  const from =
    process.env.EMAIL_FROM?.trim() || `${BRAND.name} <onboarding@resend.dev>`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
        ...(params.attachments?.length
          ? { attachments: params.attachments }
          : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        sent: false,
        reason: "provider_error",
        error: `Resend ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: "provider_error",
      error: err instanceof Error ? err.message : "Gagal mengirim email",
    };
  }
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
