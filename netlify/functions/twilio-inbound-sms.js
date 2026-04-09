const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildInboundSmsAutoReply = () =>
  [
    'Blueprint Home Solutions does not monitor this number for live replies.',
    'Please log in to your Home Pro portal or email info@blueprinthomesolutions.com.',
    'Reply STOP to opt out.',
  ].join(' ');

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const params = new URLSearchParams(event.body || '');
  const from = params.get('From') || '';
  const body = (params.get('Body') || '').trim();
  const replyBody = buildInboundSmsAutoReply();

  console.log('[SMS][INBOUND]', {
    from,
    body,
    autoReply: replyBody,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(replyBody)}</Message></Response>`,
  };
};
