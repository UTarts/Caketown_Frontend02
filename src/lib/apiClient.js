// src/lib/apiClient.js
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Central API caller. Automatically injects the stored session token.
 * Every action is a POST to api.php with { action, ...payload }.
 */
export const callApi = async (action, payload = {}) => {
  try {
    // Grab session from localStorage – safe to call in client components
    let session = null;
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('caketown_session');
      if (raw) session = JSON.parse(raw);
    }

    const body = {
      action,
      ...payload,
    };
    if (session?.id) body.actor_id = session.id;

    const response = await axios.post(`${API_BASE_URL}/api.php`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    console.error(`API Error [${action}]:`, error);
    // Normalise so callers always get { status, message }
    return {
      status: 'error',
      message:
        error.response?.data?.message ||
        error.message ||
        'Failed to connect to the Vault API.',
    };
  }
};

/** Convenience: pull the current session from localStorage */
export const getSession = () => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('caketown_session');
  return raw ? JSON.parse(raw) : null;
};

/** Convenience: clear session and redirect to login */
export const logout = (router) => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('caketown_session');
  }
  router?.push('/');
};
