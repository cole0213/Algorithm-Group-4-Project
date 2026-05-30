// Timeline.jsx — 가로 타임라인 섹션
// 포트폴리오의 projects[].period에서 날짜 범위를 추출하여 가로축에 배치.
// 다양한 한국어/영어 날짜 표기를 파싱한다.
//
// 지원 포맷:
//   "2023.06 - 2023.12", "2023-06 ~ 2023-12", "2023.6~2024.2",
//   "2023.06 - 현재", "2022 ~ 2023", "2023.06.15 - 2023.12.20",
//   "Jun 2023 - Dec 2023", "2023/06-2023/12"

const MONTHS_EN = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function parseDate(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (!s || /^(현재|now|present|진행중|진행 중|ongoing|-)$/i.test(s)) return 'now';

  // 영어 월 표기: "jun 2023", "june 2023" — 월 정확
  const enMatch = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})/);
  if (enMatch) return { year: +enMatch[2], month: MONTHS_EN[enMatch[1].slice(0, 3)], hasMonth: true };

  // 숫자 표기: YYYY.MM, YYYY-MM, YYYY/MM, YYYY.MM.DD — 월 정확
  const numMatch = s.match(/(\d{4})\s*[./\-]\s*(\d{1,2})(?:\s*[./\-]\s*\d{1,2})?/);
  if (numMatch) return { year: +numMatch[1], month: Math.min(12, +numMatch[2] || 1), hasMonth: true };

  // 연도만 — 월 불명
  const yearMatch = s.match(/(\d{4})/);
  if (yearMatch) return { year: +yearMatch[1], month: 1, hasMonth: false };

  return null;
}

function parsePeriod(period) {
  if (!period) return null;
  // 분리자: -, ~, to, until
  const parts = period.split(/\s*(?:[-~–—]|to|until|까지)\s*/i);

  if (parts.length < 2) {
    // 단일 표기 — 한 해 전체로 확장 또는 단일 월 점
    const single = parseDate(period);
    if (!single || single === 'now') return null;
    if (!single.hasMonth) {
      // "2020" 같은 표기 → 그 해 1~12월 전체로 확장하되 imprecise 표시
      return {
        start: { year: single.year, month: 1,  hasMonth: false },
        end:   { year: single.year, month: 12, hasMonth: false },
        label: period,
        imprecise: true,
      };
    }
    return { start: single, end: single, label: period, imprecise: false };
  }

  const start = parseDate(parts[0]);
  const endRaw = parseDate(parts.slice(1).join(' '));
  if (!start || start === 'now') return null;
  const end = endRaw || 'now';

  // 연도만 표기 자동 확장: 시작은 1월, 끝은 12월
  const startExpanded = !start.hasMonth
    ? { year: start.year, month: 1, hasMonth: false }
    : start;
  const endExpanded = (end !== 'now' && !end.hasMonth)
    ? { year: end.year, month: 12, hasMonth: false }
    : end;

  const imprecise = !start.hasMonth || (end !== 'now' && !end.hasMonth);
  return { start: startExpanded, end: endExpanded, label: period, imprecise };
}

function dateToFloat(d) {
  if (d === 'now') return new Date().getFullYear() + (new Date().getMonth() + 1) / 12;
  return d.year + (d.month - 1) / 12;
}

function formatDate(d) {
  if (d === 'now') return '현재';
  if (!d.hasMonth) return `${d.year}`;
  return `${d.year}.${String(d.month).padStart(2, '0')}`;
}

const TRACK_COLORS = ['#7C3AED', '#EA580C', '#0284C7', '#65A30D', '#DC2626', '#0D9488'];

export default function Timeline({ projects = [], careerYears = 0, education = '' }) {
  // 이벤트 추출
  const events = [];
  projects.forEach((p, i) => {
    const period = parsePeriod(p.period);
    if (!period) return;
    events.push({
      kind: 'project',
      label: p.name || `프로젝트 ${i + 1}`,
      stack: p.stack,
      role:  p.role,
      desc:  p.desc,
      start: period.start,
      end:   period.end,
      rawPeriod: period.label,
      imprecise: period.imprecise,
      colorIdx: i,
    });
  });

  if (!events.length) {
    return (
      <div className="timeline-empty">
        포트폴리오에서 날짜 정보가 있는 항목을 찾을 수 없습니다.
        {careerYears > 0 && <><br />경력 {careerYears}년 표기 있음.</>}
      </div>
    );
  }

  // 정렬 (시작일 기준)
  events.sort((a, b) => dateToFloat(a.start) - dateToFloat(b.start));

  // 축 범위 계산
  const allFloats = events.flatMap(e => [dateToFloat(e.start), dateToFloat(e.end)]);
  let minFloat = Math.floor(Math.min(...allFloats));
  let maxFloat = Math.ceil(Math.max(...allFloats));
  // 최소 1년 폭 확보
  if (maxFloat - minFloat < 1) maxFloat = minFloat + 1;
  // 양옆 여백
  const padding = Math.max(0.25, (maxFloat - minFloat) * 0.05);
  minFloat -= padding;
  maxFloat += padding;
  const range = maxFloat - minFloat;

  // 연도 눈금
  const yearTicks = [];
  for (let y = Math.ceil(minFloat); y <= Math.floor(maxFloat); y++) {
    yearTicks.push(y);
  }

  // 트랙 배치 — 겹치는 이벤트는 다른 트랙으로
  const tracks = [];  // 각 트랙: 마지막 이벤트 종료 위치
  const placedEvents = events.map(e => {
    const startF = dateToFloat(e.start);
    const endF   = dateToFloat(e.end);
    let track = tracks.findIndex(end => end <= startF);
    if (track === -1) {
      track = tracks.length;
      tracks.push(endF);
    } else {
      tracks[track] = endF;
    }
    return { ...e, track, startF, endF };
  });
  const trackCount = tracks.length || 1;

  return (
    <div className="timeline-container">
      <div className="timeline-scroll">
        <div className="timeline-track-area" style={{ height: trackCount * 36 + 44 }}>
          {/* 연도 눈금 */}
          {yearTicks.map(year => {
            const left = ((year - minFloat) / range) * 100;
            return (
              <div key={year} className="timeline-year-tick" style={{ left: `${left}%` }}>
                <div className="timeline-year-line" />
                <div className="timeline-year-label">{year}</div>
              </div>
            );
          })}
          {/* 이벤트 바 */}
          {placedEvents.map((e, i) => {
            const leftPct  = ((e.startF - minFloat) / range) * 100;
            const widthPct = Math.max(1.5, ((e.endF - e.startF) / range) * 100);
            const color = TRACK_COLORS[e.colorIdx % TRACK_COLORS.length];
            // imprecise: 빗금 패턴 + 점선 테두리. precise: 단색 + 실선
            const bg = e.imprecise
              ? `repeating-linear-gradient(45deg, ${color}22 0 6px, ${color}55 6px 10px)`
              : color + '22';
            const periodText = `${formatDate(e.start)}${formatDate(e.start) === formatDate(e.end) ? '' : ' ~ ' + formatDate(e.end)}`;
            return (
              <div
                key={i}
                className={`timeline-event ${e.imprecise ? 'imprecise' : ''}`}
                style={{
                  left:   `${leftPct}%`,
                  width:  `${widthPct}%`,
                  top:    e.track * 36 + 24,
                  background: bg,
                  borderLeft: `3px ${e.imprecise ? 'dashed' : 'solid'} ${color}`,
                }}
                title={`${e.label}\n${periodText}${e.imprecise ? '  (기간 추정)' : ''}${e.role ? `\n역할: ${e.role}` : ''}${e.stack ? `\n기술: ${e.stack}` : ''}`}
              >
                <span className="timeline-event-label">{e.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="timeline-legend">
        {placedEvents.some(e => e.imprecise) && (
          <span className="timeline-legend-key">
            <span className="timeline-legend-swatch imprecise" /> 기간 추정 (월 미상)
          </span>
        )}
        <span>총 {placedEvents.length}개 항목 · {Math.ceil(maxFloat - minFloat)}년 범위</span>
      </div>
    </div>
  );
}
