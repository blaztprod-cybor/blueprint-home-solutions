import { getAdminDb } from './_firebase-admin.js';

function formatRelativeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently posted';

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 1) return 'Posted just now';
  if (diffHours < 24) return `Posted ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Posted 1 day ago';
  return `Posted ${diffDays} days ago`;
}

export const handler = async () => {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('projects').orderBy('createdAt', 'desc').limit(8).get();

    const items = snapshot.docs.map((entry) => {
      const data = entry.data();
      return {
        id: entry.id,
        category: data.category || data.title || 'Home Improvement',
        town: data.location?.town || 'Local area',
        summary: formatRelativeDate(data.createdAt),
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to load recent project posts' }),
    };
  }
};
