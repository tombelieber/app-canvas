import { languages } from './locales.mjs';
export const product = 'app_canvas';
export const schemaVersion = 1;
export const eventNames = new Set(['install', 'viewer_ready', 'screen_selected', 'interaction_started', 'flow_started', 'flow_completed', 'flow_failed', 'locale_changed', 'landing_view', 'landing_cta', 'reference_copied', 'reference_copy_failed']);
const surfaces = new Set(['official_demo', 'real_project', 'landing', 'qualification']);
const sources = new Set(['install_sh', 'plugin', 'npx', 'local', 'browser', 'unknown']);
const allowed = new Set(['product', 'schema_version', 'surface', 'version', 'source', 'locale', 'action', 'page', 'environment', 'cohort_class', 'session_id', 'acquisition_source', 'campaign', 'error_code']);
const environments = new Set(['production', 'development', 'staging', 'test', 'qualification', 'unknown']);
const actions = new Set(['demo', 'start', 'release', 'github', 'cloud', 'privacy', 'install', 'copy_install']);
export const acquisitionSources = new Set(['direct', 'organic_search', 'github', 'github_release', 'reddit_showcase', 'founder_social', 'unknown']);
export const campaigns = new Set(['oss_launch', 'build_in_public', 'unknown']);
const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value || '');
export function sanitizeEvent(input) {
  if (!input || typeof input !== 'object' || Object.keys(input).some(k => !['id', 'event', 'properties', 'event_id', 'occurred_at'].includes(k))) return null;
  if (!/^[a-f0-9-]{36}$/.test(input.id || '') || !eventNames.has(input.event)) return null;
  const p = input.properties;
  if (!p || Object.keys(p).some(k => !allowed.has(k)) || !surfaces.has(p.surface) || !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(p.version || '')) return null;
  if (input.event_id !== undefined && !uuid(input.event_id)) return null;
  if (input.occurred_at !== undefined && (typeof input.occurred_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.occurred_at) || !Number.isFinite(Date.parse(input.occurred_at)))) return null;
  if (p.product !== undefined && p.product !== product || p.schema_version !== undefined && p.schema_version !== schemaVersion) return null;
  if (p.source !== undefined && !sources.has(p.source) || p.locale !== undefined && !languages.includes(p.locale) || p.action !== undefined && !actions.has(p.action) || p.page !== undefined && !['product', 'start', 'release'].includes(p.page)) return null;
  if (p.surface === 'landing' && !['landing_view', 'landing_cta'].includes(input.event)) return null;
  if (p.environment !== undefined && !environments.has(p.environment)) return null;
  if (p.session_id !== undefined && !uuid(p.session_id)) return null;
  if (p.acquisition_source !== undefined && !acquisitionSources.has(p.acquisition_source)) return null;
  if (p.campaign !== undefined && !campaigns.has(p.campaign)) return null;
  const failureCode = {reference_copy_failed: 'clipboard_unavailable', flow_failed: 'journey_failed'}[input.event];
  if (p.error_code !== undefined && p.error_code !== failureCode) return null;
  if (failureCode && p.error_code !== failureCode) return null;
  // A client can exclude its own usage, but cannot certify itself External.
  if (p.cohort_class !== undefined && !['internal_test', 'unknown'].includes(p.cohort_class)) return null;
  return { id: input.id, event: input.event, ...(input.event_id ? {event_id: input.event_id} : {}), ...(input.occurred_at ? {occurred_at: input.occurred_at} : {}), properties: { ...p, environment: p.surface === 'qualification' ? 'qualification' : p.environment ?? 'unknown', cohort_class: p.cohort_class ?? 'unknown', product, schema_version: schemaVersion } };
}
