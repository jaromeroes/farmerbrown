/**
 * Resend wrapper. Templates in English (the customer is US-based).
 *
 * Two emails today:
 *   • low-balance alert — fired by the cron when balance crosses the threshold
 *   • top-up receipt — fired by the Stripe webhook after a successful payment
 */

import { Resend } from 'resend';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const EMAIL_FROM = import.meta.env.EMAIL_FROM ?? 'billing@example.com';
const SITE_URL = import.meta.env.PUBLIC_SITE_URL ?? 'https://farmerbrown.theb2btinkerers.com';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Branded header used at the top of every transactional email.
 * The image is referenced via absolute URL so the recipient's mail
 * client can fetch it. Width/height set explicitly so clients reserve
 * space before the image loads.
 */
function emailHeaderHtml(): string {
  return `
    <p style="margin: 0 0 1.5rem;">
      <img src="${SITE_URL}/farmerbrown-logo.webp"
           alt="Farmer Brown"
           width="192" height="48"
           style="display:block;height:48px;width:auto;border:0;outline:none;text-decoration:none;" />
    </p>
  `;
}

async function send(
  to: string[],
  subject: string,
  html: string,
  text?: string,
  opts?: { idempotencyKey?: string }
): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${to.join(', ')}: "${subject}"`);
    return;
  }
  if (to.length === 0) return;

  const { error } = await resend.emails.send(
    {
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text: text ?? '',
    },
    // Resend dedupes sends with the same key for 24h — our guard against the
    // webhook + catch-up both firing for the same call.
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined
  );
  if (error) {
    throw new Error(`Resend failed: ${error.message ?? JSON.stringify(error)}`);
  }
}

/**
 * Escape characters that have special meaning inside an HTML attribute value.
 * The big one for URLs is `&`, which strictly should be `&amp;` — some email
 * clients refuse or mis-parse hrefs with raw `&`.
 */
function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendLowBalanceAlert(args: {
  to: string[];
  customerName: string;
  balanceCents: number;
  thresholdCents: number;
  currency: string;
  topupUrl: string;
}): Promise<void> {
  const balance = formatMoney(args.balanceCents, args.currency);
  const threshold = formatMoney(args.thresholdCents, args.currency);

  const html = `
    ${emailHeaderHtml()}
    <p>Hi,</p>
    <p>The balance for <strong>${args.customerName}</strong> has dropped below the
    alert threshold (${threshold}).</p>
    <p>Current balance: <strong>${balance}</strong>.</p>
    <p>You can add credit from the portal: <a href="${args.topupUrl}">${args.topupUrl}</a></p>
    <p>—<br/>Farmer Brown AI Hub</p>
  `;

  await send(args.to, `Low balance — ${args.customerName} (${balance})`, html);
}

export async function sendTopupReceipt(args: {
  to: string[];
  customerName: string;
  amountCents: number;
  newBalanceCents: number;
  currency: string;
  receiptUrl?: string | null;
}): Promise<void> {
  const amount = formatMoney(args.amountCents, args.currency);
  const newBalance = formatMoney(args.newBalanceCents, args.currency);

  const html = `
    ${emailHeaderHtml()}
    <p>Hi,</p>
    <p>We've received a top-up of <strong>${amount}</strong> for
    <strong>${args.customerName}</strong>.</p>
    <p>New balance: <strong>${newBalance}</strong>.</p>
    ${args.receiptUrl ? `<p>Stripe receipt: <a href="${args.receiptUrl}">${args.receiptUrl}</a></p>` : ''}
    <p>—<br/>Farmer Brown AI Hub</p>
  `;

  await send(args.to, `Top-up received — ${amount}`, html);
}

/**
 * Builders Risk lead notification. `bodyHtml` is the inner HTML produced by
 * `leadEmail.renderLeadBodyHtml`; we wrap it with the brand header. Idempotent
 * via `idempotencyKey` (use `br-lead-<callId>`).
 */
export async function sendLeadSummary(args: {
  to: string[];
  subject: string;
  bodyHtml: string;
  text: string;
  idempotencyKey?: string;
}): Promise<void> {
  const html = `
    ${emailHeaderHtml()}
    ${args.bodyHtml}
    <p style="color:#9ca3af;font-size:0.8rem;margin-top:1.5rem;">
      — Farmer Brown AI Hub · automated lead notification
    </p>
  `;
  await send(args.to, args.subject, html, args.text, {
    idempotencyKey: args.idempotencyKey,
  });
}

export async function sendMagicLink(args: {
  to: string;
  verifyUrl: string;
}): Promise<void> {
  const safeHref = escapeHtmlAttr(args.verifyUrl);
  const html = `
    ${emailHeaderHtml()}
    <p>Hi,</p>
    <p>Click the button below to sign in to your Farmer Brown AI Hub.</p>
    <p style="margin: 1.5rem 0;">
      <a href="${safeHref}"
         style="background:#2563eb;color:#fff;padding:0.625rem 1.25rem;
                border-radius:6px;text-decoration:none;font-weight:500;
                display:inline-block;font-family:-apple-system,sans-serif;">
        Sign in
      </a>
    </p>
    <p style="color:#6b6b6b;font-size:0.875rem;">
      Or copy this link into your browser:<br/>
      <a href="${safeHref}" style="color:#2563eb;word-break:break-all;">${safeHref}</a>
    </p>
    <p style="color:#6b6b6b;font-size:0.875rem;">
      This link expires in 1 hour. If you didn't request it, you can ignore this email.
    </p>
    <p>—<br/>Farmer Brown AI Hub</p>
  `;
  const text =
    `Sign in to your Farmer Brown AI Hub:\n\n` +
    `${args.verifyUrl}\n\n` +
    `This link expires in 1 hour. If you didn't request it, you can ignore this email.\n\n` +
    `— Farmer Brown AI Hub`;
  await send([args.to], 'Sign in to Farmer Brown AI Hub', html, text);
}
