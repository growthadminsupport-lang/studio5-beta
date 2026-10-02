import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatDate, renderEmail } from './mail.templates';

/**
 * GrowTH email (password reset, address confirmation, invitations, notices), sent through
 * Resend's HTTP API. The layout is in mail.templates.ts.
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
  sendPasswordResetEmail(
    email: string,
    resetToken: string,
    name?: string,
  ): Promise<boolean> {
    const { html, text } = renderEmail({
      preheader: 'A link to choose a new GrowTH password, valid for one hour.',
      greeting: greet(name),
      paragraphs: [
        'We received a request to reset the password for the GrowTH account registered to this email address.',
        'To choose a new password, please use the button below. For your security, the link can be used once and expires one hour after this email was sent.',
      ],
      action: {
        label: 'Choose a new password',
        url: `${this.appUrl}/reset-password?token=${resetToken}`,
      },
      footnote:
        'If you did not request a password reset, no action is needed: your password has not been changed.',
    });
    return this.send(email, 'Reset your GrowTH password', text, html);
  }

  /** Confirms that a password-registered address really belongs to the person who signed up. */
  sendVerificationEmail(
    email: string,
    token: string,
    name?: string,
  ): Promise<boolean> {
    const { html, text } = renderEmail({
      preheader:
        'Please confirm your email address to finish setting up GrowTH.',
      greeting: greet(name),
      paragraphs: [
        'Thank you for creating a GrowTH account. Please confirm that this email address belongs to you.',
        'Confirming your address lets you recover your account and receive invitations and notices from the people caring for your child. The link expires in 48 hours.',
      ],
      action: {
        label: 'Confirm my email address',
        url: `${this.appUrl}/verify-email?token=${token}`,
      },
      footnote:
        'If you did not create a GrowTH account, please ignore this email. The account will stay unconfirmed and cannot be used to receive invitations.',
    });
    return this.send(email, 'Please confirm your email address', text, html);
  }

  /** An invitation to follow a child as their caretaker or doctor. */
  sendInvitation(input: {
    to: string;
    inviterName: string;
    childFirstName: string;
    role: 'CARETAKER' | 'DOCTOR';
    link: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const role = input.role === 'DOCTOR' ? 'doctor' : 'caretaker';
    const { html, text } = renderEmail({
      preheader: `${input.inviterName} has invited you to follow ${input.childFirstName}'s growth on GrowTH.`,
      greeting: 'Dear recipient,',
      paragraphs: [
        `${input.inviterName} has invited you to join GrowTH as ${input.childFirstName}'s ${role}.`,
        input.role === 'DOCTOR'
          ? 'GrowTH is a child growth and development platform. As the child’s doctor you will be able to view growth and puberty records, add hand X-rays for bone age assessment, and share your reading with the family. A doctor account approved by GrowTH is required.'
          : 'GrowTH is a child growth and development platform. As a caretaker you will be able to record measurements and complete the puberty questionnaire. Screening results are shared with the parent and the child’s doctor.',
        'To accept, please use the button below and sign in or create an account.',
      ],
      details: [
        ['Child', input.childFirstName],
        ['Your role', role[0].toUpperCase() + role.slice(1)],
        ['Invited by', input.inviterName],
        ['Valid until', formatDate(input.expiresAt)],
      ],
      action: { label: 'Accept invitation', url: input.link },
      footnote:
        'This invitation can be used only once. If you were not expecting it, you may ignore this email; no account will be created and no information will be shared with you.',
    });
    return this.send(
      input.to,
      `Invitation to follow ${input.childFirstName}'s growth on GrowTH`,
      text,
      html,
    );
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
    name?: string,
  ): Promise<boolean> {
    const { html, text } = renderEmail({
      preheader: body,
      greeting: greet(name),
      paragraphs: [
        body,
        'For privacy, the details are only shown inside GrowTH after you sign in.',
      ],
      action: { label: 'View in GrowTH', url: `${this.appUrl}${path}` },
      footnote:
        'You are receiving this notice because your GrowTH account is linked to this child.',
    });
    return this.send(to, subject, text, html);
  }
}

function greet(name?: string | null) {
  return name?.trim() ? `Dear ${name.trim()},` : 'Dear GrowTH user,';
}
