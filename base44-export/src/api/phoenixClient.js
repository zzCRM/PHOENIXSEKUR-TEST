const TOKEN_KEY = 'phoenix_access_token';
const API_BASE = '/api';
const VITRINE_URL = (import.meta.env.VITE_VITRINE_URL || 'https://www.phoenixsekur.com').replace(/\/$/, '');

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('base44_access_token');
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('base44_access_token');
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

function createEntityHandler(entityName) {
  return {
    async list(sort, limit, skip) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      if (skip) params.set('skip', String(skip));
      const qs = params.toString();
      return apiFetch(`/entities/${entityName}${qs ? `?${qs}` : ''}`);
    },

    async filter(query, sort, limit, skip) {
      const params = new URLSearchParams();
      params.set('q', JSON.stringify(query || {}));
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      if (skip) params.set('skip', String(skip));
      return apiFetch(`/entities/${entityName}?${params}`);
    },

    async get(id) {
      return apiFetch(`/entities/${entityName}/${id}`);
    },

    async create(data) {
      return apiFetch(`/entities/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id, data) {
      return apiFetch(`/entities/${entityName}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(id) {
      return apiFetch(`/entities/${entityName}/${id}`, { method: 'DELETE' });
    },
  };
}

const ENTITY_NAMES = [
  'Agent', 'Alerte', 'BonIntervention', 'CahierConsignes', 'Client',
  'CompanySettings', 'Conge', 'Contrat', 'Demande', 'Document',
  'FicheDePaie', 'Geolocation', 'Invoice', 'Lead', 'MainCourante',
  'Mission', 'PostePlanning', 'PretMateriel', 'PriseDeService',
  'Ronde', 'RondeExecution', 'Site', 'User',
];

const entities = new Proxy(
  {},
  {
    get(_target, name) {
      if (typeof name !== 'string' || name === 'then') return undefined;
      return createEntityHandler(name);
    },
  }
);

ENTITY_NAMES.forEach((name) => {
  entities[name] = createEntityHandler(name);
});

export const phoenix = {
  entities,

  reports: {
    async sendEmail(payload) {
      return apiFetch('/reports/send-email', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async runScheduled() {
      return apiFetch('/reports/run-scheduled', { method: 'POST', body: '{}' });
    },
  },

  auth: {
    async me() {
      return apiFetch('/auth/me');
    },

    async loginViaEmailPassword(email, password, portal) {
      const result = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, portal }),
      });
      if (result.access_token) setToken(result.access_token);
      const me = await apiFetch('/auth/me');
      return { ...result, user: { ...result.user, superadmin: me.superadmin } };
    },

    async getInvitation(token) {
      return apiFetch(`/auth/invitation/${token}`);
    },

    async acceptInvitation({ token, password, first_name, last_name }) {
      const result = await apiFetch('/auth/accept-invitation', {
        method: 'POST',
        body: JSON.stringify({ token, password, first_name, last_name }),
      });
      if (result.access_token) setToken(result.access_token);
      return result;
    },

    async logout(redirectUrl) {
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      } catch {
        /* redirect même si l'API échoue */
      }
      clearToken();
      const dest = typeof redirectUrl === 'string' && redirectUrl.startsWith('http')
        ? redirectUrl
        : redirectUrl === null
          ? undefined
          : `${typeof window !== 'undefined' ? window.location.origin : ''}/login`;
      if (dest) window.location.href = dest;
    },

    redirectToLogin() {
      window.location.href = `${window.location.origin}/login`;
    },

    setToken,
    getToken,
  },

  users: {
    async list() {
      return apiFetch('/users');
    },
    async inviteUser(email, role = 'user') {
      return apiFetch('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    },
    async updateUser(id, data) {
      return apiFetch(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    async deleteUser(id) {
      return apiFetch(`/users/${id}`, { method: 'DELETE' });
    },
    async resendInvitation(id) {
      return apiFetch(`/users/invitations/${id}/resend`, { method: 'POST' });
    },
    async deleteInvitation(id) {
      return apiFetch(`/users/invitations/${id}`, { method: 'DELETE' });
    },
    async smtpStatus() {
      return apiFetch('/users/smtp-status');
    },
  },

  admin: {
    async stats() {
      return apiFetch('/admin/stats');
    },
    async listUsers() {
      return apiFetch('/admin/users');
    },
    async createUser(data) {
      return apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async updateUser(id, data) {
      return apiFetch(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    async listCompanies() {
      return apiFetch('/admin/companies');
    },
    async deleteUser(id) {
      return apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
    },
    async listInvitations() {
      return apiFetch('/admin/invitations');
    },
    async resendInvitation(id) {
      return apiFetch(`/admin/invitations/${id}/resend`, { method: 'POST' });
    },
    async listSignupRequests(status) {
      const q = status ? `?status=${encodeURIComponent(status)}` : '';
      return apiFetch(`/admin/signup-requests${q}`);
    },
    async approveSignupRequest(id, trial_days) {
      return apiFetch(`/admin/signup-requests/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ trial_days }),
      });
    },
    async rejectSignupRequest(id, notes) {
      return apiFetch(`/admin/signup-requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
    },
    async updateCompanySubscription(companyId, data) {
      return apiFetch(`/admin/companies/${companyId}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    async getSettings() {
      return apiFetch('/admin/settings');
    },
    async updateSettings(data) {
      return apiFetch('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  },

  integrations: {
    Core: {
      UploadFile: ({ file }) => uploadFile(file),
      InvokeLLM: async () => {
        throw new Error('Fonction IA non disponible en mode autonome');
      },
      SendEmail: async () => {
        throw new Error('Envoi email non configuré — Phase 5');
      },
    },
  },

  functions: {
    async invoke(name) {
      if (name === 'getGoogleMapsApiKey') {
        const res = await apiFetch('/config/google-maps-key');
        return { data: { apiKey: res.apiKey || res.data?.apiKey || '' } };
      }
      throw new Error(`Unknown function: ${name}`);
    },
  },
};

export default phoenix;
