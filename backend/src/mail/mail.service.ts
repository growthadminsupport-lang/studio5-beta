import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Password-reset email, sent through Resend's HTTP API.
 *
 * There used to be a raw-SMTP fallback here. It was unreachable: this service prefers Resend
 * whenever RESEND_API_KEY is set, and Render — the only place this runs — blocks outbound
 * SMTP ports outright, so the fallback could not have delivered anything even if it had been
 * selected. Keeping five SMTP_* variables configured on production for a code path that
 * could never run just widened the set of secrets to look after.
 *
 * Local development needs no mail provider at all: with RESEND_API_KEY unset, AuthService
 * hands the reset token straight back in the response (outside production only).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? null;
    // SMTP_FROM is the historical name and is still read so an existing deployment keeps
    // working without a coordinated env change.
    this.from =
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('SMTP_FROM') ??
      'GrowTH <onboarding@resend.dev>';
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    if (!this.apiKey) {
      this.logger.warn(
        'RESEND_API_KEY is not set — password reset emails will not be sent.',
      );
    }
  }

  get isConfigured() {
    return this.apiKey !== null;
  }

  /** The frontend origin, without a trailing slash, for links in emails. */
  get appUrl() {
    return this.frontendUrl.replace(/\/$/, '');
  }

  /**
   * Sends one email through Resend. Returns true only if the provider accepted it. Never
   * throws: every caller treats email as a best-effort extra on top of something that has
   * already happened (an in-app notification, a saved record).
   */
  async send(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [to],
          subject,
          text,
          ...(html ? { html } : {}),
        }),
      });
      if (!res.ok) {
        this.logger.error(
          `Resend returned ${res.status} sending to ${to}: ${await res.text()}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" to ${to}`, err as Error);
      return false;
    }
  }

  /** Returns true only if the provider accepted the message. */
  sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetLink = `${this.appUrl}/reset-password?token=${resetToken}`;
    const text =
      'We received a request to reset your GrowTH password. Open this link to choose a new one ' +
      `(expires in 1 hour):\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`;
    const html = `
      <p>We received a request to reset your GrowTH password.</p>
      <p><a href="${resetLink}">Click here to choose a new password</a> (link expires in 1 hour).</p>
      <p>If you didn't request this, you can ignore this email.</p>
    `;
    return this.send(email, 'Reset your GrowTH password', text, html);
  }

  /**
   * A short notice with one link back into the app. Deliberately carries no medical detail:
   * email is not a place for a child's screening result, so it only says there is something
   * to read and where.
   */
  sendNotice(
    to: string,
    subject: string,
    body: string,
    path: string,
  ): Promise<boolean> {
    const link = `${this.appUrl}${path}`;
    return this.send(
      to,
      subject,
      `${body}\n\nOpen GrowTH: ${link}`,
      `<p>${escapeHtml(body)}</p><p><a href="${link}">Open GrowTH</a></p>`,
    );
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
