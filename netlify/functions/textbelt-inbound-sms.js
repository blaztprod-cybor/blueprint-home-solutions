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

  const payload = JSON.parse(event.body || '{}');
  const from = typeof payload?.fromNumber === 'string' ? payload.fromNumber : '';
  const body = typeof payload?.text === 'string' ? payload.text.trim() : '';
  const replyBody = buildInboundSmsAutoReply();

  console.log('[SMS][INBOUND]', {
    from,
    body,
    autoReply: replyBody,
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoReply: replyBody }),
  };
};
