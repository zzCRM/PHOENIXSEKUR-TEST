import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { establishPhoenixSession } from '@/lib/phoenixSession';

const AuthContext = createContext();

async function fetchSessionToken() {
  try {
    const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
    const sessionData = await sessionRes.json();
    if (sessionData.authenticated && sessionData.access_token) {
      return sessionData.access_token;
    }
  } catch {
    // Pas de cookie de session, ou réseau indisponible.
  }
  return null;
}

async function readCurrentUser() {
  try {
    const user = await base44.auth.me();
    return { ok: true, status: 200, user };
  } catch (error) {
    return { ok: false, status: error.status, user: null };
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const applySessionResult = (result) => {
    if (result.ok && result.user) {
      setUser(result.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return;
    }
    setUser(null);
    setIsAuthenticated(false);
    setAuthError({ type: 'auth_required', message: 'Authentication required' });
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    const result = await establishPhoenixSession({
      getToken: () => base44.auth.getToken?.() || null,
      setToken: (token) => base44.auth.setToken(token),
      clearLocalToken: () => base44.auth.clearLocalToken(),
      me: readCurrentUser,
      fetchSession: fetchSessionToken,
    });
    applySessionResult(result);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    return result.ok;
  };

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'phoenixsekur', public_settings: {} });
      await checkUserAuth();
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkAppState();
  }, []);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout(shouldRedirect ? undefined : null);
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
