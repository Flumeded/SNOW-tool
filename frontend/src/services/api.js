const API_BASE = '/api';

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchCases(params = {}) {
  const query = new URLSearchParams(params).toString();
  return fetchJSON(`${API_BASE}/cases${query ? `?${query}` : ''}`);
}

export async function fetchCase(caseNumber) {
  return fetchJSON(`${API_BASE}/cases/${caseNumber}`);
}

export async function fetchUrgentCases() {
  return fetchJSON(`${API_BASE}/cases/urgent`);
}

export async function fetchOverviewStats() {
  return fetchJSON(`${API_BASE}/stats/overview`);
}

export async function fetchDailyStats() {
  return fetchJSON(`${API_BASE}/stats/daily`);
}

export async function fetchWeeklyTrend() {
  return fetchJSON(`${API_BASE}/stats/trend`);
}

export async function fetchSettings() {
  return fetchJSON(`${API_BASE}/settings`);
}

export async function updateSettings(settings) {
  return fetchJSON(`${API_BASE}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}

export async function fetchRecentNotifications() {
  return fetchJSON(`${API_BASE}/notifications/recent`);
}

export async function uploadCSV(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || `Upload error: ${response.status}`);
  }

  return response.json();
}

export async function healthCheck() {
  return fetchJSON(`${API_BASE}/health`);
}

export async function resetDatabase() {
  return fetchJSON(`${API_BASE}/reset`, {
    method: 'POST'
  });
}
