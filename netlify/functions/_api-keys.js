import crypto from 'node:crypto';

export const API_KEYS_COLLECTION = 'api_keys';
const API_KEY_PREFIX = 'bhs_live_';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

export function hashApiKey(token) {
  return sha256(token);
}

export function isApiKeyToken(value) {
  return String(value || '').trim().startsWith(API_KEY_PREFIX);
}

export function parseApiKeyToken(value) {
  const token = String(value || '').trim();
  if (!isApiKeyToken(token)) return null;

  const separatorIndex = token.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return null;
  }

  return {
    token,
    prefix: token.slice(0, separatorIndex),
    secret: token.slice(separatorIndex + 1),
  };
}

export function createApiKeySecret() {
  const identifier = crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(24).toString('hex');
  const prefix = `${API_KEY_PREFIX}${identifier}`;
  const token = `${prefix}.${secret}`;

  return {
    token,
    prefix,
    lastFour: secret.slice(-4),
    tokenHash: hashApiKey(token),
  };
}

export function maskApiKey(prefix, lastFour) {
  if (!prefix) return '';
  return `${prefix}...${String(lastFour || '').slice(-4)}`;
}

export function buildApiKeyRecord({
  prefix,
  tokenHash,
  lastFour,
  name,
  ownerUid,
  ownerEmail,
  ownerRole,
  subscriptionLevel,
  createdByUid,
  createdByEmail,
  createdAt,
}) {
  return {
    prefix,
    tokenHash,
    lastFour,
    name: String(name || 'Default key').trim() || 'Default key',
    status: 'active',
    ownerUid,
    ownerEmail: String(ownerEmail || '').trim().toLowerCase(),
    ownerRole: ownerRole || '',
    subscriptionLevel: subscriptionLevel || 'none',
    createdByUid: createdByUid || ownerUid,
    createdByEmail: String(createdByEmail || ownerEmail || '').trim().toLowerCase(),
    createdAt,
    updatedAt: createdAt,
    lastUsedAt: null,
    lastUsedIp: '',
    lastUsedUserAgent: '',
  };
}
