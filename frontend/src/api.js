const BASE_URL = 'http://127.0.0.1:8000/api';

async function fetcher(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const localRepo = localStorage.getItem('x-github-repo');
  const localToken = localStorage.getItem('x-github-token');

  if (localRepo) {
    headers['X-GitHub-Repo'] = localRepo;
  }
  if (localToken) {
    headers['X-GitHub-Token'] = localToken;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    throw new Error(`API Error: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  getHistory: (params = '') => fetcher(`/history${params}`),
  getIncident: (id) => fetcher(`/incident/${id}`),
  getIncidentAudit: (id) => fetcher(`/incidents/${id}/audit`),
  getStats: () => fetcher(`/dashboard/stats`),
  getDecisions: (params = '') => fetcher(`/decisions${params}`),
  listSamples: () => fetcher(`/samples`),
  loadSample: (scenario) => fetcher(`/load-sample/${scenario}`, { method: 'POST' }),
  submitIncident: (data) => fetcher(`/incidents`, { method: 'POST', body: JSON.stringify(data) }),
  resolveIncident: (id, solution, commitCaused = null) => fetcher(`/incidents/${id}/resolve`, { method: 'POST', body: JSON.stringify({ incident_id: id, solution, commit_caused: commitCaused }) }),
  getGithubStatus: () => fetcher('/integrations/github/status'),
  connectGithub: (data) => fetcher('/integrations/github/connect', { method: 'POST', body: JSON.stringify(data) }),
  disconnectGithub: () => fetcher('/integrations/github/disconnect', { method: 'DELETE' }),
  updateGithub: (data) => fetcher('/integrations/github', { method: 'PATCH', body: JSON.stringify(data) }),
};
