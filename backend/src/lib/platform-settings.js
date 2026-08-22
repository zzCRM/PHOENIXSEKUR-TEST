import { prisma } from './prisma.js';

export const DEFAULT_SETTINGS = {
  default_trial_days: 14,
  invitation_subject: 'Invitation à rejoindre Phoenix Sekur',
  invitation_body_html: `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
  <h2 style="color: #c0392b;">Phoenix Sekur</h2>
  <p>Bonjour,</p>
  <p>{{invited_by_line}}</p>
  <p>Cliquez sur le bouton ci-dessous pour créer votre compte :</p>
  <p style="margin: 28px 0;">
    <a href="{{invite_url}}" style="background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
      Créer mon compte
    </a>
  </p>
  <p style="font-size: 13px; color: #666;">Ou copiez ce lien :<br><a href="{{invite_url}}">{{invite_url}}</a></p>
  <p style="font-size: 13px; color: #666;">Ce lien expire dans 7 jours.</p>
</div>`,
  invitation_body_text: `Bonjour,

{{invited_by_line}}

Cliquez sur le lien ci-dessous pour créer votre compte :
{{invite_url}}

Ce lien expire dans 7 jours.

— L'équipe Phoenix Sekur`,
  signup_notify_emails: 'serviceclient@ppsecurity.fr',
};

export async function getPlatformSettings() {
  let row = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    row = await prisma.platformSettings.create({
      data: { id: 'default', data: DEFAULT_SETTINGS },
    });
  }
  const data = typeof row.data === 'object' && row.data !== null ? row.data : {};
  return { ...DEFAULT_SETTINGS, ...data };
}

export async function updatePlatformSettings(partial) {
  const current = await getPlatformSettings();
  const merged = { ...current, ...partial };
  await prisma.platformSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', data: merged },
    update: { data: merged },
  });
  return merged;
}

export function renderTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replaceAll(`{{${key}}}`, String(val ?? '')),
    template
  );
}

export async function getCompanySubscription(companyId) {
  if (!companyId) return null;
  return prisma.companySubscription.findUnique({ where: { companyId } });
}

export async function isCompanyAccessAllowed(companyId) {
  const sub = await getCompanySubscription(companyId);
  if (!sub) return true;
  if (sub.status === 'suspended') return false;
  if (sub.status === 'trial' && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
    return false;
  }
  return true;
}
