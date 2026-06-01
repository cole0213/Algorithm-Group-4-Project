// api.js — 백엔드 API 호출 래퍼
// Vite proxy: /api → http://localhost:8000/api

const BASE = '/api';

export async function analyzePortfolios(requiredSpecs, sortKey = 'match', weights = null) {
  const body = { required_specs: requiredSpecs, sort_key: sortKey };
  if (weights) body.weights = weights;
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`analyze 실패: ${res.status}`);
  const data = await res.json();
  return data.portfolios;
}

export async function searchPortfolios(query, mode = 'cross', portfolioId = null, useAlias = true) {
  const params = new URLSearchParams({ q: query, mode, use_alias: useAlias ? 'true' : 'false' });
  if (portfolioId) params.set('portfolio_id', portfolioId);
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`search 실패: ${res.status}`);
  const data = await res.json();
  return mode === 'cross' ? data.matched_ids : data;
}

export async function uploadPortfolio({ file, text, name, position = 'general', bypassDuplicateCheck = false }) {
  const form = new FormData();
  if (file)        form.append('file', file);
  if (text?.trim()) form.append('text', text.trim());
  if (name?.trim()) form.append('name', name.trim());
  form.append('position', position);
  if (bypassDuplicateCheck) form.append('skip_content_check', 'true');

  const res = await fetch(`${BASE}/portfolios/add`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `업로드 실패: ${res.status}`);
  }
  const data = await res.json();
  return {
    portfolio:         data.portfolio,
    solar:             data.solar,
    duplicate_file:    data.duplicate_file    ?? false,
    duplicate_name:    data.duplicate_name    ?? false,
    content_duplicate: data.content_duplicate ?? null,
  };
}

export async function renamePortfolio(portfolioId, name) {
  const res = await fetch(`${BASE}/portfolios/${encodeURIComponent(portfolioId)}/name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `이름 변경 실패: ${res.status}`);
  }
  return await res.json();
}

export async function deletePortfolio(portfolioId) {
  const res = await fetch(`${BASE}/portfolios/${encodeURIComponent(portfolioId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
  return await res.json();
}

export async function fetchRaw(portfolioId) {
  const res = await fetch(`${BASE}/portfolios/${encodeURIComponent(portfolioId)}/raw`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`raw 실패: ${res.status}`);
  return await res.json(); // { raw: string, ext: string }
}

export async function exportPortfolios(settings = {}) {
  const res = await fetch(`${BASE}/portfolios/export`);
  if (!res.ok) throw new Error('내보내기 실패');
  const data = await res.json();
  // settings 포함
  data.settings = settings;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolios_export_${today}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importPortfolios(file, mode = 'overwrite') {
  const form = new FormData();
  form.append('file', file);
  form.append('mode', mode);  // 'overwrite' | 'reset'
  const res = await fetch(`${BASE}/portfolios/import`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `불러오기 실패: ${res.status}`);
  }
  return await res.json(); // { message, total, settings }
}

export async function reanalyzePortfolio(portfolioId) {
  const res = await fetch(`${BASE}/portfolios/${encodeURIComponent(portfolioId)}/reanalyze`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `재분석 실패: ${res.status}`);
  }
  return await res.json(); // { message, portfolio, solar }
}

export async function extractSpecs(text) {
  const res = await fetch(`${BASE}/extract-specs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    let detail = '추출 실패';
    try { detail = JSON.parse(body).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function extractConfig(text) {
  const res = await fetch(`${BASE}/extract-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    let detail = '설정 추출 실패';
    try { detail = JSON.parse(body).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function diffPortfolios(ids) {
  const res = await fetch(`${BASE}/diff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `diff 실패: ${res.status}`);
  }
  return res.json();
}

export async function summarizePortfolio(portfolioId, { requiredSpecs = [], weights = null } = {}) {
  const body = { required_specs: requiredSpecs };
  if (weights) body.weights = weights;
  const res = await fetch(`${BASE}/portfolios/${encodeURIComponent(portfolioId)}/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `요약 실패: ${res.status}`);
  }
  return res.json(); // { summary, elapsed, config_version }
}

export async function summarizeAllPortfolios({ requiredSpecs = [], weights = null } = {}) {
  const body = { required_specs: requiredSpecs };
  if (weights) body.weights = weights;
  const res = await fetch(`${BASE}/portfolios/summarize-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `전체 요약 실패: ${res.status}`);
  }
  return res.json(); // { results: [{id, elapsed?, error?, skipped?}], config_version, total }
}

export async function fetchSimilarMap(ids = null, groupColors = null) {
  const params = ids?.length ? '?' + new URLSearchParams({ ids: ids.join(',') }) : '';
  const res = await fetch(`${BASE}/similar${params}`);
  if (!res.ok) throw new Error(`similar 실패: ${res.status}`);
  const data = await res.json();
  // { portfolio_id: [{text, group, color}] } 형태로 변환, groupColors로 색상 오버라이드
  const map = {};
  for (const span of data.spans) {
    if (!map[span.portfolio_id]) map[span.portfolio_id] = [];
    const color = groupColors?.length ? groupColors[span.group % groupColors.length] : span.color;
    map[span.portfolio_id].push({ ...span, color });
  }
  return map;
}
