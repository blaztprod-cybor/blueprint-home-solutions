const TEXTBELT_API_KEY = process.env.TEXTBELT_API_KEY;
const TEXTBELT_SENDER = process.env.TEXTBELT_SENDER || 'Blueprint Home Solutions';

export function isSmsConfigured() {
  return !!TEXTBELT_API_KEY;
}

export function normalizeUsPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return String(value || '').trim();
}

export async function sendSms({ to, body }) {
  if (!isSmsConfigured()) {
    throw new Error('SMS provider is not configured');
  }

  const params = new URLSearchParams({
    phone: normalizeUsPhoneNumber(to),
    message: body,
    key: TEXTBELT_API_KEY,
  });

  if (TEXTBELT_SENDER) {
    params.set('sender', TEXTBELT_SENDER);
  }

  const response = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to send SMS notification');
  }

  return data;
}
