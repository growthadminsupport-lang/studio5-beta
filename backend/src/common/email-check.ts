import { BadRequestException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { promises as dns } from 'dns';

/**
 * Turns away addresses that cannot be a real, reachable mailbox before an account is made:
 *
 * - disposable inboxes (mailinator and ~120,000 others, from the MIT-licensed
 *   `disposable-email-domains` list), which exist to dodge exactly the checks this app relies
 *   on: invitations and password resets go to that address;
 * - domains with no mail server at all (a typo like gmial.com, or an invented domain).
 *
 * Neither proves the person owns the mailbox. The confirmation email does that; this only
 * stops obvious fakes at the door with a message the person can act on.
 *
 * The list is read for each check and then dropped: held in memory it costs 18 MB, which the
 * bone-age model needs more on a 512 MB instance, and registrations are rare.
 */
export async function assertDeliverableEmail(
  email: string,
  options: { checkDns: boolean },
): Promise<void> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) throw new BadRequestException('Enter a valid email address');

  const listPath = require.resolve('disposable-email-domains');
  const disposable = JSON.parse(await readFile(listPath, 'utf8')) as string[];
  if (disposable.includes(domain)) {
    throw new BadRequestException(
      'Temporary or disposable email addresses cannot be used. Please use an address you will keep, so invitations and password resets reach you.',
    );
  }

  if (!options.checkDns) return;
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 4000);
    if (mx.length === 0) throw Object.assign(new Error(), { code: 'ENODATA' });
  } catch (err) {
    const code = (err as { code?: string }).code;
    // Only a definite "no such domain / no mail server" refuses. A slow or failing resolver
    // must not stop a real person from signing up.
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      throw new BadRequestException(
        `We could not find a mail server for ${domain}. Please check the email address for typos.`,
      );
    }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })),
        ms,
      ),
    ),
  ]);
}
