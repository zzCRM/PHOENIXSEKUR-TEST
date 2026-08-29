import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import phoenix from './phoenixClient.js';

const useOwnApi = import.meta.env.VITE_USE_OWN_API === 'true';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const base44Sdk = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
});

// Switch: own API (Phase 1+) vs Base44 (legacy)
export const base44 = useOwnApi ? phoenix : base44Sdk;
export const isOwnApi = useOwnApi;
