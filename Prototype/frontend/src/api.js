// api.js — 백엔드 API 호출 래퍼
// Vite proxy: /api → http://localhost:8000/api

const BASE = '/api';

export async function analyzePortfolios(requiredSpecs, sortKey = 'match') {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ required_specs: requiredSpecs, sort_key: sortKey }),
  });
  if (!res.ok) throw new Error(`analyze 실패: ${res.status}`);
  const data = await res.json();
  return data.portfolios;
}

export async function searchIntra(portfolioId, query) {
  const params = new URLSearchParams({ q: query, mode: 'intra', portfolio_id: portfolioId });
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`intra search 실패: ${res.status}`);
  return await res.json(); // { positions: [{start,end}], contexts: [...] }
}

export async function searchPortfolios(query, mode = 'cross', portfolioId = null) {
  const params = new URLSearchParams({ q: query, mode });
  if (portfolioId) params.set('portfolio_id', portfolioId);
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) throw new Error(`search 실패: ${res.status}`);
  const data = await res.json();
  return mode === 'cross' ? data.matched_ids : data;
}

export async function uploadPortfolio({ file, text, name }) {
  const form = new FormData();
  if (file)        form.append('file', file);
  if (text?.trim()) form.append('text', text.trim());
  if (name?.trim()) form.append('name', name.trim());

  const res = await fetch(`${BASE}/portfolios/add`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `업로드 실패: ${res.status}`);
  }
  const data = await res.json();
  return { portfolio: data.portfolio, solar: data.solar };
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

export function exportPortfolios() {
  // 브라우저에서 직접 다운로드 트리거
  const a = document.createElement('a');
  a.href = `${BASE}/portfolios/export`;
  a.download = 'portfolios_export.json';
  a.click();
}

export async function importPortfolios(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/portfolios/import`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `불러오기 실패: ${res.status}`);
  }
  return await res.json();
}

export async function fetchSimilarMap() {
  const res = await fetch(`${BASE}/similar`);
  if (!res.ok) throw new Error(`similar 실패: ${res.status}`);
  const data = await res.json();
  // { portfolio_id: [{text, group, color}] } 형태로 변환
  const map = {};
  for (const span of data.spans) {
    if (!map[span.portfolio_id]) map[span.portfolio_id] = [];
    map[span.portfolio_id].push(span);
  }
  return map;
}
