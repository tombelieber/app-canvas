// Small, explicit events only: no SDK, DOM capture, replay, raw URLs or referrers.
const sources = new Set(['direct', 'organic_search', 'github', 'github_release', 'reddit_showcase', 'founder_social', 'unknown']);
const campaigns = new Set(['oss_launch', 'build_in_public', 'unknown']);
const actions = new Set(['demo', 'start', 'release', 'github', 'cloud', 'privacy', 'install', 'copy_install']);
const uuid = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value || '');
const endpoint = 'https://app-canvas-services.vickyai-tech.workers.dev/capture';
const preference = document.getElementById('analytics-choice');
const blocked = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
let id, enabled = false, attribution, session;

function firstTouch() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('app-canvas:attribution')); } catch {}
  if (sources.has(saved?.acquisition_source) && campaigns.has(saved?.campaign)) return {acquisition_source: saved.acquisition_source, campaign: saved.campaign};
  const params = new URLSearchParams(location.search);
  let acquisition_source = sources.has(params.get('ac_source')) ? params.get('ac_source') : 'unknown';
  if (!params.has('ac_source')) {
    if (!document.referrer) acquisition_source = 'direct';
    else {
      try {
        const host = new URL(document.referrer).hostname;
        if (host === 'github.com') acquisition_source = 'github';
        else if (/^(?:www\.)?(?:google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(host)) acquisition_source = 'organic_search';
      } catch {}
    }
  }
  const result = { acquisition_source, campaign: campaigns.has(params.get('ac_campaign')) ? params.get('ac_campaign') : 'unknown' };
  localStorage.setItem('app-canvas:attribution', JSON.stringify(result));
  return result;
}

if (!blocked) {
  try {
    enabled = localStorage.getItem('app-canvas:telemetry') !== 'false';
    // An opt-out does not create identifiers or read acquisition context.
    if (enabled) {
      const saved = localStorage.getItem('app-canvas:anonymous-id');
      id = uuid(saved) ? saved : crypto.randomUUID();
      localStorage.setItem('app-canvas:anonymous-id', id);
      const previousSession = sessionStorage.getItem('app-canvas:session-id');
      session = uuid(previousSession) ? previousSession : crypto.randomUUID();
      sessionStorage.setItem('app-canvas:session-id', session);
      attribution = firstTouch();
    }
  } catch { enabled = false; }
}

function track(event, extra = {}) {
  if (!enabled || !id || blocked) return;
  try { if (localStorage.getItem('app-canvas:telemetry') === 'false') return; } catch { return; }
  const body = document.body.dataset;
  let cohort_class = 'unknown';
  try { if (localStorage.getItem('app-canvas:telemetry-cohort') === 'internal_test') cohort_class = 'internal_test'; } catch { return; }
  const payload = {
    id, event, event_id: crypto.randomUUID(), occurred_at: new Date().toISOString(),
    properties: { ...extra, ...attribution, session_id: session, surface: 'landing', version: body.version, locale: body.locale || document.documentElement.lang || 'en', page: body.page || 'product', source: 'browser', environment: 'production', cohort_class },
  };
  fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(3000) }).catch(() => {});
}

if (preference) {
  preference.checked = enabled;
  preference.disabled = !!blocked;
  preference.addEventListener('change', () => {
    enabled = preference.checked && !blocked;
    try {
      localStorage.setItem('app-canvas:telemetry', String(enabled));
      if (enabled && !id) {
        const saved = localStorage.getItem('app-canvas:anonymous-id');
        id = uuid(saved) ? saved : crypto.randomUUID(); localStorage.setItem('app-canvas:anonymous-id', id);
        session = crypto.randomUUID(); sessionStorage.setItem('app-canvas:session-id', session);
        attribution = firstTouch();
      }
    } catch { enabled = false; preference.checked = false; }
  });
}

track('landing_view');
document.addEventListener('click', event => {
  const action = event.target.closest?.('[data-action]')?.dataset.action;
  if (actions.has(action)) track('landing_cta', { action });
});
