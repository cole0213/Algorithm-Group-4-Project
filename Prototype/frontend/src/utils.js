// utils.js — 공유 유틸 함수
export function matchClass(pct) {
  if (pct === 0)  return 'match-none';
  if (pct >= 70)  return 'match-high';
  if (pct >= 40)  return 'match-mid';
  return 'match-low';
}
