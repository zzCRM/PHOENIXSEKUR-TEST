const TOKEN_KEY = 'phoenix_access_token';
const API_BASE = '/api';

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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
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

  auth: {
    async me() {
      return apiFetch('/auth/me');
    },

    async loginViaEmailPassword(email, password) {
      const result = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (result.access_token) setToken(result.access_token);
      const me = await apiFetch('/auth/me');
      return { ...result, user: { ...result.user, superadmin: me.superadmin } };
    },

    logout(redirectUrl) {
      clearToken();
      if (redirectUrl) window.location.href = '/login';
    },

    redirectToLogin(returnUrl) {
      const url = returnUrl
        ? `/login?return=${encodeURIComponent(returnUrl)}`
        : '/login';
      window.location.href = url;
    },

    setToken,
    getToken,
  },

  users: {
    async inviteUser(email, role = 'user') {
      return apiFetch('/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
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
