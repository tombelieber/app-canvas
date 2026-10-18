import { languages } from './locales.mjs';
export const product = 'app_canvas';
export const schemaVersion = 1;
export const eventNames = new Set(['install', 'viewer_ready', 'screen_selected', 'interaction_started', 'flow_started', 'flow_completed', 'locale_changed', 'landing_view', 'landing_cta']);
const surfaces = new Set(['official_demo', 'real_project', 'landing', 'qualification']);
const sources = new Set(['install_sh', 'plugin', 'npx', 'local', 'browser']);
const allowed = new Set(['product', 'schema_version', 'surface', 'version', 'source', 'locale', 'action', 'page']);
const actions = new Set(['demo', 'start', 'release', 'github', 'cloud', 'privacy']);
export function sanitizeEvent(input) {
  if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['id', 'event', 'properties'].includes(k))) return null;
  if (!/^[a-f0-9-]{36}$/.test(input.id || '') || !eventNames.has(input.event)) return null;
  const p = input.properties;
  if (!p || Object.keys(p).some(k => !allowed.has(k)) || !surfaces.has(p.surface) || !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(p.version || '')) return null;
  if (p.product !== undefined && p.product !== product || p.schema_version !== undefined && p.schema_version !== schemaVersion) return null;
  if (p.source !== undefined && !sources.has(p.source) || p.locale !== undefined && !languages.includes(p.locale) || p.action !== undefined && !actions.has(p.action) || p.page !== undefined && !['product', 'start', 'release'].includes(p.page)) return null;
  if (p.surface === 'landing' && !['landing_view', 'landing_cta'].includes(input.event)) return null;
  return { id: input.id, event: input.event, properties: { ...p, product, schema_version: schemaVersion } };
}
