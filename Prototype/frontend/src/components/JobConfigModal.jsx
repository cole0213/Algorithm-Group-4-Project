// JobConfigModal.jsx — 채용 설정 통합 모달
// 필요스펙·가중치·표시 섹션·필터·AI 자동 추출을 한 곳에서 편집한다.

import { useState, useEffect } from 'react';
import { extractConfig } from '../api';

const POSITIONS = [
  { value: '',         label: '전체 / 미지정' },
  { value: 'frontend', label: '프론트엔드' },
  { value: 'backend',  label: '백엔드' },
  { value: 'data',     label: '데이터·AI' },
];

export default function JobConfigModal({
  open,
  onClose,
  // 현재 값 (controlled)
  requiredSpecs,
  weights,
  customSections,
  extractedFilter,
  // 콜백
  onApply,  // (config: {specs_text, weights, custom_sections, min_career_years, education_keywords, position}) => void
}) {
  // 로컬 편집 상태 — 모달 열릴 때 부모 값으로 초기화
  const [specs, setSpecs] = useState(requiredSpecs || '');
  const [w, setW] = useState(weights || { skill: 60, career: 25, project: 15 });
  const [customs, setCustoms] = useState(customSections || []);
  const [customInput, setCustomInput] = useState('');
  const [minCareer, setMinCareer] = useState(extractedFilter?.min_career_years ?? '');
  const [eduKeywords, setEduKeywords] = useState((extractedFilter?.education_keywords || []).join(', '));
  const [position, setPosition] = useState(extractedFilter?.position || '');

  // AI 자동 추출
  const [jobDescText, setJobDescText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);

  // 모달 열릴 때마다 부모 상태로 리셋
  useEffect(() => {
    if (!open) return;
    setSpecs(requiredSpecs || '');
    setW(weights || { skill: 60, career: 25, project: 15 });
    setCustoms(customSections || []);
    setCustomInput('');
    setMinCareer(extractedFilter?.min_career_years ?? '');
    setEduKeywords((extractedFilter?.education_keywords || []).join(', '));
    setPosition(extractedFilter?.position || '');
    setJobDescText('');
    setExtractError(null);
  }, [open, requiredSpecs, weights, customSections, extractedFilter]);

  if (!open) return null;

  function addCustomSection() {
    const t = customInput.trim();
    if (!t || customs.includes(t) || customs.length >= 6) return;
    setCustoms(prev => [...prev, t]);
    setCustomInput('');
  }

  function removeCustomSection(title) {
    setCustoms(prev => prev.filter(s => s !== title));
  }

  function updateWeight(field, value) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    setW(prev => ({ ...prev, [field]: v }));
  }

  const wTotal = w.skill + w.career + w.project;

  async function handleAiExtract() {
    if (!jobDescText.trim()) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const cfg = await extractConfig(jobDescText);
      // 추출된 값으로 모달 내부 상태 업데이트 (visible_sections는 사용 안함 — 기본 섹션 고정)
      if (cfg.specs_text) setSpecs(cfg.specs_text);
      if (cfg.weights) setW(cfg.weights);
      if (cfg.min_career_years !== null && cfg.min_career_years !== undefined) setMinCareer(cfg.min_career_years);
      if (Array.isArray(cfg.education_keywords)) setEduKeywords(cfg.education_keywords.join(', '));
      if (cfg.position) setPosition(cfg.position);
    } catch (e) {
      setExtractError(e.message);
    } finally {
      setExtracting(false);
    }
  }

  function handleApply() {
    const config = {
      specs_text: specs.trim(),
      weights: w,
      custom_sections: customs,
      min_career_years: minCareer === '' || minCareer === null ? null : Number(minCareer),
      education_keywords: eduKeywords.split(',').map(s => s.trim()).filter(Boolean),
      position: position || null,
    };
    onApply?.(config);
    onClose?.();
  }

  return (
    <div className="job-config-overlay" onClick={onClose}>
      <div className="job-config-modal" onClick={e => e.stopPropagation()}>
        <div className="job-config-header">
          <span className="job-config-title">채용 설정</span>
          <button className="job-config-close" onClick={onClose}>✕</button>
        </div>

        <div className="job-config-body">
          {/* AI 자동 추출 */}
          <section className="job-config-section">
            <h3 className="job-config-section-title">
              <span className="icon-btn-img ai-icon" /> AI 자동 추출
            </h3>
            <p className="job-config-section-desc">
              채용 공고 + 보고 싶은 항목을 자연어로 입력하면 Solar LLM이 아래 설정값을 자동으로 채웁니다.
            </p>
            <textarea
              className="job-config-textarea"
              placeholder={"예) 백엔드 채용. Python·FastAPI 필수, AWS·Kubernetes 우대.\n경력 3년 이상. 학사 이상.\n기본정보·기술·프로젝트·타임라인만 보고 싶고 자기소개는 빼줘. 프로젝트 비중 크게."}
              value={jobDescText}
              onChange={e => setJobDescText(e.target.value)}
              rows={5}
            />
            <div className="job-config-extract-row">
              <button
                className="job-config-extract-btn"
                onClick={handleAiExtract}
                disabled={extracting || !jobDescText.trim()}
              >
                {extracting ? '추출 중...' : '✨ AI로 아래 설정 채우기'}
              </button>
              {extractError && <span className="job-config-extract-err">오류: {extractError}</span>}
            </div>
          </section>

          <div className="job-config-divider" />

          {/* 필요 스펙 */}
          <section className="job-config-section">
            <h3 className="job-config-section-title">필요 스펙</h3>
            <p className="job-config-section-desc">쉼표로 구분된 기술 스택 목록.</p>
            <input
              className="job-config-input"
              type="text"
              value={specs}
              onChange={e => setSpecs(e.target.value)}
              placeholder="React, Python, Docker"
            />
          </section>

          {/* 가중치 */}
          <section className="job-config-section">
            <h3 className="job-config-section-title">
              가중치 <span className="job-config-weight-total">합 {wTotal}{wTotal !== 100 ? ' (자동 정규화)' : ''}</span>
            </h3>
            {[
              { key: 'skill',   label: '기술 매칭' },
              { key: 'career',  label: '경력' },
              { key: 'project', label: '프로젝트' },
            ].map(({ key, label }) => (
              <div key={key} className="job-config-weight-row">
                <label className="job-config-weight-label">{label}</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={w[key]}
                  onChange={e => updateWeight(key, e.target.value)}
                  className="job-config-weight-slider"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={w[key]}
                  onChange={e => updateWeight(key, e.target.value)}
                  className="job-config-weight-num"
                />
              </div>
            ))}
          </section>

          {/* 추가 섹션 */}
          <section className="job-config-section">
            <h3 className="job-config-section-title">추가 섹션</h3>
            <p className="job-config-section-desc">
              기본 7개 섹션(기본 정보 · 기술 스택 · 자기소개 · 타임라인 · 프로젝트 · 수상 · 중요 링크) 외에
              추가로 표시할 섹션을 정의하세요. 최대 6개.
            </p>
            <div className="job-config-custom-input-row">
              <input
                className="job-config-input"
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSection(); } }}
                placeholder="예: 오픈소스 기여, 외국어 능력, 봉사 활동"
                maxLength={30}
              />
              <button
                className="job-config-custom-add-btn"
                onClick={addCustomSection}
                disabled={!customInput.trim() || customs.length >= 6 || customs.includes(customInput.trim())}
              >
                + 추가
              </button>
            </div>
            {customs.length > 0 && (
              <div className="job-config-custom-list">
                {customs.map(title => (
                  <span key={title} className="job-config-custom-chip">
                    {title}
                    <button
                      className="job-config-custom-remove"
                      onClick={() => removeCustomSection(title)}
                      title="제거"
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* 필터 */}
          <section className="job-config-section">
            <h3 className="job-config-section-title">필터</h3>
            <div className="job-config-filter-row">
              <label className="job-config-filter-label">최소 경력</label>
              <input
                type="number"
                min={0}
                max={30}
                className="job-config-filter-input small"
                value={minCareer ?? ''}
                onChange={e => setMinCareer(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="제한 없음"
              />
              <span className="job-config-filter-unit">년 이상</span>
            </div>
            <div className="job-config-filter-row">
              <label className="job-config-filter-label">학력 키워드</label>
              <input
                type="text"
                className="job-config-filter-input"
                value={eduKeywords}
                onChange={e => setEduKeywords(e.target.value)}
                placeholder="예: 대학교, 학사"
              />
            </div>
            <div className="job-config-filter-row">
              <label className="job-config-filter-label">직군</label>
              <select
                className="job-config-filter-input"
                value={position}
                onChange={e => setPosition(e.target.value)}
              >
                {POSITIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </section>
        </div>

        <div className="job-config-footer">
          <button className="import-cancel-btn" onClick={onClose}>취소</button>
          <button className="job-config-apply-btn" onClick={handleApply}>
            적용 + 전체 재분석
          </button>
        </div>
      </div>
    </div>
  );
}
