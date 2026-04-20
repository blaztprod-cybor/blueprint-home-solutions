const DEFAULT_BLUEPRINT_DOB_INTELLIGENCE_API_URL = 'https://blueprint-dob-intelligence-api-placeholder.com';

export const BLUEPRINT_DOB_INTELLIGENCE_API_URL =
  (import.meta.env.VITE_BLUEPRINT_DOB_INTELLIGENCE_API_URL || '').trim() ||
  DEFAULT_BLUEPRINT_DOB_INTELLIGENCE_API_URL;
