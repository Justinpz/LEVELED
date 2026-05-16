'use strict';

/**
 * WHOOP OAuth + API client.
 *
 * Wraps the WHOOP OAuth 2.0 flow and a couple of API endpoints we need
 * for Phase 1. All network calls go through axios with explicit
 * Content-Type so WHOOP's token endpoint accepts them.
 */

const axios = require('axios');

const HOSTNAME = process.env.WHOOP_API_HOSTNAME || 'https://api.prod.whoop.com';

const AUTHORIZE_URL = `${HOSTNAME}/oauth/oauth2/auth`;
const TOKEN_URL = `${HOSTNAME}/oauth/oauth2/token`;
const PROFILE_URL = `${HOSTNAME}/developer/v1/user/profile/basic`;

const REQUIRED_SCOPES = [
  'offline',
  'read:profile',
  'read:recovery',
  'read:cycles',
  'read:sleep',
  'read:workout',
  'read:body_measurement',
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in environment`);
  return v;
}

function buildAuthorizeUrl({ state, redirectUri }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: requireEnv('WHOOP_CLIENT_ID'),
    redirect_uri: redirectUri,
    scope: REQUIRED_SCOPES.join(' '),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens({ code, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: requireEnv('WHOOP_CLIENT_ID'),
    client_secret: requireEnv('WHOOP_CLIENT_SECRET'),
  });
  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  // { access_token, refresh_token, expires_in, scope, token_type }
  return data;
}

async function refreshAccessToken({ refreshToken }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: requireEnv('WHOOP_CLIENT_ID'),
    client_secret: requireEnv('WHOOP_CLIENT_SECRET'),
    scope: REQUIRED_SCOPES.join(' '),
  });
  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  return data;
}

async function fetchProfile({ accessToken }) {
  const { data } = await axios.get(PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
  });
  // { user_id, email, first_name, last_name }
  return data;
}

module.exports = {
  REQUIRED_SCOPES,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchProfile,
};
