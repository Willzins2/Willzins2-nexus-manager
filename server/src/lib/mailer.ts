import nodemailer from 'nodemailer';
import { env } from '../config/env';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Envia e-mail via SMTP; sem SMTP configurado, apenas registra no log (desenvolvimento/demo). */
export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    console.info(`[mailer] SMTP não configurado. E-mail para ${to}: ${subject}\n${html.replace(/<[^>]+>/g, ' ')}`);
    return;
  }
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
}
