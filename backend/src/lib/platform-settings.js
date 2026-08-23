import { prisma } from './prisma.js';

/** Catalogue des modèles d'email éditables (Super Admin). */
export const EMAIL_TEMPLATE_DEFS = [
  {
    id: 'invitation_collaborateur',
    label: 'Invitation collaborateur / salarié',
    audience: 'collaborateur',
    description: 'Envoyé quand une société crée un compte Phoenix Sekur pour un collaborateur.',
    vars: ['invite_url', 'role_label', 'invited_by', 'invited_by_line', 'company_name'],
  },
  {
    id: 'invitation_client',
    label: 'Invitation client',
    audience: 'client',
    description: 'Envoyé quand une société crée un compte Phoenix Sekur pour un client.',
    vars: ['invite_url', 'role_label', 'invited_by', 'invited_by_line', 'company_name'],
  },
  {
    id: 'invitation_societe',
    label: 'Invitation société de sécurité',
    audience: 'societe',
    description: 'Envoyé lors de l\'approbation d\'une inscription ou création d\'admin société.',
    vars: ['invite_url', 'role_label', 'invited_by', 'invited_by_line', 'company_name'],
  },
  {
    id: 'password_reset',
    label: 'Réinitialisation mot de passe',
    audience: 'tous',
    description: 'Lien de reset mot de passe (tous les portails).',
    vars: ['reset_url', 'company_name'],
  },
  {
    id: 'signup_notify',
    label: 'Alerte nouvelle inscription (interne)',
    audience: 'interne',
    description: 'Notification interne quand une société demande un essai depuis la vitrine.',
    vars: ['company_name', 'contact_name', 'email', 'phone', 'message', 'admin_url'],
  },
  {
    id: 'report_client',
    label: 'Envoi de rapport au client',
    audience: 'client',
    description: 'Email accompagnant un rapport PDF (rondes, main courante, etc.).',
    vars: ['company_name', 'period_start', 'period_end', 'modules', 'stats_summary', 'app_url'],
  },
];

const DEFAULT_INVITE_HTML = `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
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
</div>`;

const DEFAULT_INVITE_TEXT = `Bonjour,

{{invited_by_line}}

Cliquez sur le lien ci-dessous pour créer votre compte :
{{invite_url}}

Ce lien expire dans 7 jours.

— L'équipe Phoenix Sekur`;

export const DEFAULT_EMAIL_TEMPLATES = {
  invitation_collaborateur: {
    subject: '{{company_name}} vous invite sur Phoenix Sekur',
    body_html: DEFAULT_INVITE_HTML,
    body_text: DEFAULT_INVITE_TEXT,
  },
  invitation_client: {
    subject: '{{company_name}} vous invite sur votre espace client Phoenix Sekur',
    body_html: DEFAULT_INVITE_HTML,
    body_text: DEFAULT_INVITE_TEXT,
  },
  invitation_societe: {
    subject: 'Bienvenue sur Phoenix Sekur — activez votre espace société',
    body_html: DEFAULT_INVITE_HTML,
    body_text: DEFAULT_INVITE_TEXT,
  },
  password_reset: {
    subject: 'Réinitialisation de votre mot de passe — Phoenix Sekur',
    body_html: `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
  <h2 style="color: #c0392b;">Phoenix Sekur</h2>
  <p>Bonjour,</p>
  <p>Cliquez pour choisir un nouveau mot de passe (lien valide 1 heure) :</p>
  <p style="margin: 28px 0;">
    <a href="{{reset_url}}" style="background:#c0392b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Nouveau mot de passe</a>
  </p>
  <p style="font-size: 13px; color: #666;">Ou copiez ce lien :<br><a href="{{reset_url}}">{{reset_url}}</a></p>
</div>`,
    body_text: `Bonjour,

Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe (valide 1 heure) :
{{reset_url}}

— L'équipe Phoenix Sekur`,
  },
  signup_notify: {
    subject: '[Phoenix Sekur] Nouvelle demande d\'inscription — {{company_name}}',
    body_html: `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
  <h2 style="color: #c0392b;">Nouvelle inscription</h2>
  <p><strong>Société :</strong> {{company_name}}</p>
  <p><strong>Contact :</strong> {{contact_name}}</p>
  <p><strong>Email :</strong> {{email}}</p>
  <p><strong>Téléphone :</strong> {{phone}}</p>
  <p><strong>Message :</strong> {{message}}</p>
  <p><a href="{{admin_url}}">Ouvrir Super Admin</a></p>
</div>`,
    body_text: `Nouvelle demande d'inscription :

Société : {{company_name}}
Contact : {{contact_name}}
Email : {{email}}
Téléphone : {{phone}}
Message : {{message}}

Gérer : {{admin_url}}`,
  },
  report_client: {
    subject: 'Rapport de sécurité — {{company_name}} ({{period_start}} → {{period_end}})',
    body_html: `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
  <h2 style="color: #c0392b;">Rapport de sécurité</h2>
  <p><strong>{{company_name}}</strong></p>
  <p>Période : {{period_start}} → {{period_end}}</p>
  <pre style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:13px;">{{stats_summary}}</pre>
  <p>Modules : {{modules}}</p>
  <p><a href="{{app_url}}">Ouvrir Phoenix Sekur</a></p>
</div>`,
    body_text: `Rapport de sécurité — {{company_name}}
Période : {{period_start}} → {{period_end}}

{{stats_summary}}

Modules : {{modules}}

Consultez l'application : {{app_url}}`,
  },
};

export const DEFAULT_SETTINGS = {
  default_trial_days: 14,
  // Compat anciens champs (fallback invitation générique)
  invitation_subject: '{{company_name}} vous invite sur Phoenix Sekur',
  invitation_body_html: DEFAULT_INVITE_HTML,
  invitation_body_text: DEFAULT_INVITE_TEXT,
  signup_notify_emails: 'serviceclient@ppsecurity.fr',
  email_templates: DEFAULT_EMAIL_TEMPLATES,
};

export function invitationTemplateIdForRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'client') return 'invitation_client';
  if (r === 'admin' || r === 'superadmin') return 'invitation_societe';
  return 'invitation_collaborateur';
}

export function getEmailTemplate(settings, templateId) {
  const defaults = DEFAULT_EMAIL_TEMPLATES[templateId] || {};
  const stored = settings?.email_templates?.[templateId] || {};
  // Compat invitation_* plats pour les 3 invitations
  if (templateId.startsWith('invitation_')) {
    return {
      subject: stored.subject || settings?.invitation_subject || defaults.subject,
      body_html: stored.body_html || settings?.invitation_body_html || defaults.body_html,
      body_text: stored.body_text || settings?.invitation_body_text || defaults.body_text,
    };
  }
  return {
    subject: stored.subject || defaults.subject || '',
    body_html: stored.body_html || defaults.body_html || '',
    body_text: stored.body_text || defaults.body_text || '',
  };
}

export async function getPlatformSettings() {
  let row = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  if (!row) {
    row = await prisma.platformSettings.create({
      data: { id: 'default', data: DEFAULT_SETTINGS },
    });
  }
  const data = typeof row.data === 'object' && row.data !== null ? row.data : {};
  const merged = { ...DEFAULT_SETTINGS, ...data };
  merged.email_templates = {
    ...DEFAULT_EMAIL_TEMPLATES,
    ...(typeof data.email_templates === 'object' && data.email_templates ? data.email_templates : {}),
  };
  return merged;
}

export async function updatePlatformSettings(partial) {
  const current = await getPlatformSettings();
  const merged = { ...current, ...partial };
  if (partial.email_templates && typeof partial.email_templates === 'object') {
    merged.email_templates = {
      ...current.email_templates,
      ...partial.email_templates,
    };
    // Deep-merge each template
    for (const [id, tpl] of Object.entries(partial.email_templates)) {
      if (tpl && typeof tpl === 'object') {
        merged.email_templates[id] = {
          ...(current.email_templates?.[id] || DEFAULT_EMAIL_TEMPLATES[id] || {}),
          ...tpl,
        };
      }
    }
  }
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
    template || ''
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
