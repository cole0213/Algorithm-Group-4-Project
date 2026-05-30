// constants.js — 프로젝트 전반 공유 상수
export const STORAGE_KEYS = {
  CACHE:     'portfolio-reviewer-cache',
  MARKS:     'portfolio-reviewer-marks',
  BOOKMARKS: 'portfolio-reviewer-bookmarks',
  NOTES:     'portfolio-reviewer-notes',
  SETTINGS:  'portfolio-reviewer-settings',
  SPECS:     'portfolio-reviewer-specs',
  WEIGHTS:   'portfolio-reviewer-weights',
};

export const DEFAULT_SPECS = 'React, Python, Docker';

export const DEFAULT_WEIGHTS = { skill: 60, career: 25, project: 15 };

// 패널 강조 색상 — PortfolioPanel.jsx accentIdx 매핑
export const ACCENT_COLORS = ['#7C3AED','#EA580C','#2DC653','#DC2626','#0284C7','#65A30D'];

// 블라인드 모드 가명 생성용
export const BLIND_ADJECTIVES = ['빠른','조용한','밝은','차가운','따뜻한','강한','유연한','예리한','신중한','활발한'];
export const BLIND_NOUNS      = ['사자','독수리','여우','호랑이','늑대','곰','매','표범','치타','수달'];
