import React, { useState, useEffect, useMemo, useRef } from 'react';
import './HomePage.css';

const ON_ENTER_CTX = React.createContext(() => {});

/* ============================================================
   Reveal hook
============================================================ */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;if (!el) return;
    // If already in viewport, reveal immediately.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      el.classList.add("in");
      return;
    }
    const obs = new IntersectionObserver((es) => {
      es.forEach((e) => {if (e.isIntersecting) {e.target.classList.add("in");obs.unobserve(e.target);}});
    }, { threshold: 0.12 });
    obs.observe(el);
    // Fallback: ensure content appears even if IO never fires.
    const t = setTimeout(() => {if (el && !el.classList.contains("in")) el.classList.add("in");}, 800);
    return () => {obs.disconnect();clearTimeout(t);};
  }, []);
  return ref;
}

/* Global scroll-reveal: observes every .reveal element (current + future).
   Adds .in when it scrolls into view. One observer, MutationObserver picks
   up dynamically-rendered nodes (e.g. cards that mount after state changes). */
function useScrollReveals() {
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    const scan = () => {
      document.querySelectorAll(".reveal:not(.in)").forEach((el) => {
        // reveal immediately if already on-screen at load
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92 && r.bottom > 0) { el.classList.add("in"); return; }
        io.observe(el);
      });
    };
    scan();

    const mo = new MutationObserver(() => scan());
    mo.observe(document.body, { childList: true, subtree: true });

    // safety: reveal anything still hidden after 3s
    const t = setTimeout(() => document.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in")), 3000);

    return () => { io.disconnect(); mo.disconnect(); clearTimeout(t); };
  }, []);
}

/* Wrapper that carries the scroll-reveal (opacity + slide) so inner cards keep
   their own hover transform without conflict. */
function RevealItem({ delay = 0, variant = "reveal-rise", style, children }) {
  return (
    <div className={"reveal " + variant} style={{ "--rd": delay + "ms", display: "grid", ...style }}>
      {children}
    </div>
  );
}

/* ============================================================
   01 — MASTHEAD (top editorial bar + nav)
============================================================ */
function Masthead() {
  const onEnter = React.useContext(ON_ENTER_CTX);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={"nav " + (scrolled ? "scrolled" : "")}>
      <div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <div className="row gap-3">
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.2em", color: "var(--muted)" }}>
            <span style={{ color: "var(--a-blue)" }}>◆</span>&nbsp; PORTFOLIO REVIEWER &nbsp;/&nbsp; v0.4
          </span>
        </div>
        <nav className="row gap-6" style={{ fontFamily: "var(--f-mono)", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
          <a href="#abstract">Abstract</a>
          <a href="#interface">Interface</a>
          <a href="#method">Method</a>
          <a href="#demo">Demo</a>
          <a href="#catalog">Algorithms</a>
          <a href="#features">Features</a>
          <a href="#colophon">Colophon</a>
        </nav>
        <button type="button" onClick={onEnter} className="btn solid" style={{ padding: "8px 14px", fontSize: 10 }}>
          Open Workspace <span className="arr">→</span>
        </button>
      </div>
    </header>);

}

/* Inline typewriter used in Hero sub-strip — cycles high-level value lines */
const HERO_LINES = [
  { a: "수십 명의 지원자 포트폴리오를, ",        b: "한 화면에서 비교·정렬·검출",  c: "한다." },
  { a: "표기가 달라도 · 오타가 있어도 · ",     b: "동일하게 잡아낸다",        c: "." },
  { a: "Solar LLM이 PDF·MD·TXT를 ",            b: "동일한 스키마로 정형화",   c: "한다." },
  { a: "여덟 가지 알고리즘이 ",               b: "매칭·정렬·유사 문장 검출", c: "을 처리한다." },
  { a: "결과는 색 띄로 구분된 카드로, ",       b: "종이처럼 한 화면에 펼쳐진",   c: "다." },
];
function HeroTypewriter() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("type");
  const line = HERO_LINES[idx];
  const full = line.a + line.b + line.c;

  useEffect(() => {
    if (phase === "type") {
      if (text === full) { const t = setTimeout(() => setPhase("hold"), 0); return () => clearTimeout(t); }
      const delay = 28 + Math.random() * 60;
      const t = setTimeout(() => setText(full.slice(0, text.length + 1)), delay);
      return () => clearTimeout(t);
    }
    if (phase === "hold")  { const t = setTimeout(() => setPhase("erase"), 2000); return () => clearTimeout(t); }
    if (phase === "erase") {
      if (text === "") { setPhase("next"); return; }
      const t = setTimeout(() => setText(text.slice(0, -1)), 14);
      return () => clearTimeout(t);
    }
    if (phase === "next")  { setIdx((idx + 1) % HERO_LINES.length); setPhase("type"); }
  }, [phase, text, idx, full]);

  // split typed text back into a / b / c so the middle phrase gets the scan highlight
  const lenA = line.a.length;
  const lenB = line.b.length;
  const partA = text.slice(0, Math.min(text.length, lenA));
  const partB = text.length > lenA ? text.slice(lenA, Math.min(text.length, lenA + lenB)) : "";
  const partC = text.length > lenA + lenB ? text.slice(lenA + lenB) : "";

  return (
    <>
      <span>{partA}</span>
      {partB && <span className="scan">{partB}</span>}
      <span>{partC}</span>
      <span className="blink-caret" style={{ display: "inline-block", marginLeft: 2, fontStyle: "normal", fontWeight: 600, color: "var(--ink)" }}>▌</span>
    </>
  );
}

/* ============================================================
   02 — HERO  (newspaper masthead)
============================================================ */
function Hero() {
  const ref = useReveal();
  return (
    <section style={{ paddingTop: 56, paddingBottom: 88, background: "var(--desk)" }}>
      <div className="shell fade-up" ref={ref}>
        {/* Top meta strip */}
        <div className="row between" style={{ paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
          <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", color: "var(--muted)", textTransform: "uppercase" }}>
            Algorithm Team Capstone Project &nbsp;·&nbsp; 2025
          </div>
          <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", color: "var(--muted)", textTransform: "uppercase" }}>
            PDF · MD · TXT → 정렬된 비교
          </div>
        </div>

        {/* Big masthead title */}
        <div style={{ paddingTop: 56, paddingBottom: 32, textAlign: "left" }}>
          <h1 className="display" style={{
            fontSize: "clamp(64px, 12vw, 184px)",
            letterSpacing: "-0.045em",
            lineHeight: 0.88,
            color: "var(--ink)"
          }}>
            The&nbsp;Portfolio<br />
            <span style={{ fontStyle: "italic", fontWeight: 500 }}>Reviewer.</span>
          </h1>
        </div>

        {/* Sub-strip */}
        <div style={{ borderTop: "6px solid var(--ink)", borderBottom: "1px solid var(--ink)", padding: "14px 0", marginTop: 8 }}>
          <div className="row between wrap gap-4">
            <div className="serif" style={{
              fontSize: "clamp(18px, 2.2vw, 26px)",
              fontStyle: "italic",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              maxWidth: 800,
              lineHeight: 1.25,
              minHeight: "1.5em"
            }}>
              <HeroTypewriter />
            </div>
            <div className="row gap-3">
              <a href="#interface" className="btn solid">Read on <span className="arr">↓</span></a>
              <a href="#method" className="btn ghost">Skip to method</a>
            </div>
          </div>
        </div>

        {/* Byline row */}
        <div className="row wrap gap-8" style={{ marginTop: 32 }}>
          <div className="col gap-1">
            <span className="smcaps">Filed under</span>
            <span className="serif" style={{ fontSize: 15, fontWeight: 500 }}>Hiring &nbsp;·&nbsp; Information Retrieval</span>
          </div>
          <div className="col gap-1">
            <span className="smcaps">Stack</span>
            <span className="serif" style={{ fontSize: 15, fontWeight: 500 }}>Solar LLM &nbsp;·&nbsp; 8 Algorithms</span>
          </div>
          <div className="col gap-1">
            <span className="smcaps">Input</span>
            <span className="serif" style={{ fontSize: 15, fontWeight: 500 }}>PDF &nbsp;·&nbsp; Markdown</span>
          </div>
          <div className="col gap-1">
            <span className="smcaps">Output</span>
            <span className="serif" style={{ fontSize: 15, fontWeight: 500 }}>Ranked Comparison</span>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <ReviewConsole />
          </div>
        </div>
      </div>
    </section>);

}

const PIPE_STAGES = [
  { n: "01", k: "INGEST",  label: "수집",         sub: "PDF · MD · TXT",
    detail: "지원자가 업로드한 문서를 한 곳에 모은다. 형식이 제각각이어도 상관 없다.",
    accent: "var(--muted)" },
  { n: "02", k: "PARSE",   label: "Solar LLM",   sub: "JSON 정형화",
    detail: "이름·기술스택·경력·프로젝트·학력을 추출해 동일한 스키마로 변환한다. 이후 알고리즘은 모두 같은 입력을 받는다.",
    accent: "var(--a-blue)" },
  { n: "03", k: "PROCESS", label: "8 알고리즘",  sub: "Hash · BST · LCS · RK",
    detail: "매칭·정렬·유사 문장 검출이 동시에 일어난다. 각 알고리즘은 자료구조 수업의 한 챕터에 대응한다.",
    accent: "var(--a-green)" },
  { n: "04", k: "COMPARE", label: "비교 출력",    sub: "한 화면, 색 띠 구분",
    detail: "결과는 색 띠로 구분된 문서 카드로 책상 위 종이처럼 펼쳐진다. 인사 담당자는 좌측에서 클릭으로 후보를 전환한다.",
    accent: "var(--a-orange)" },
];

function Abstract() {
  const ref = useReveal();
  const [active, setActive] = useState(1);

  // auto-advance
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % PIPE_STAGES.length), 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="abstract" style={{ background: "var(--white)", padding: "132px 0 132px", position: "relative", borderTop: "1px solid var(--line)" }}>
      <div className="shell" ref={ref}>
        {/* Header — matches other sections (left rail + title + desc) */}
        <div className="sh-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 56, marginBottom: 56 }}>
          <div className="col gap-2">
            <span className="smcaps" style={{ color: "var(--ink)" }}>§ 00 · System Schematic</span>
            <div style={{ width: 56, height: 2, background: "var(--ink)" }}/>
          </div>
          <div>
            <h2 className="display" style={{ fontSize: "clamp(36px, 5.5vw, 64px)", lineHeight: 0.98 }}>
              네 단계의 파이프라인.
            </h2>
            <p className="serif" style={{ marginTop: 18, fontSize: 16, lineHeight: 1.5, color: "var(--ink-soft)", maxWidth: 620, fontStyle: "italic" }}>
              인사 담당자의 책상 위 무질서 — 수십 부의 포트폴리오, 제각각인 표기, 머릿속의 비교 — 를 네 개의 단계로 정돈한다.
            </p>
          </div>
        </div>

        {/* Pipeline — 4 nodes + 3 connectors */}
        <PipelineRow active={active} setActive={setActive} />

        {/* Detail panel for active stage */}
        <PipelineDetail stage={PIPE_STAGES[active]} index={active} />
      </div>
    </section>);
}

function PipelineRow({ active, setActive }) {
  return (
    <div className="pipe-row" style={{
      display: "grid",
      gridTemplateColumns: "1fr 36px 1fr 36px 1fr 36px 1fr",
      gap: 0,
      alignItems: "stretch",
      marginBottom: 28,
    }}>
      {PIPE_STAGES.map((s, i) => (
        <React.Fragment key={s.n}>
          <RevealItem delay={i * 90}><PipeNode s={s} i={i} on={active === i} onClick={() => setActive(i)} /></RevealItem>
          {i < PIPE_STAGES.length - 1 && <PipeArrow on={active === i || active === i + 1} />}
        </React.Fragment>
      ))}

      <style>{`
        @media (max-width: 880px) {
          .pipe-row { grid-template-columns: 1fr !important; gap: 10px !important; }
          .pipe-arrow-h { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function PipeNode({ s, i, on, onClick }) {
  return (
    <button onClick={onClick} style={{
      all: "unset", cursor: "pointer", display: "block",
      padding: "20px 18px",
      background: on ? "var(--paper)" : "transparent",
      border: on ? `1px solid ${s.accent}` : "1px dashed var(--line-strong)",
      borderLeft: on ? `4px solid ${s.accent}` : "4px solid var(--line-strong)",
      transition: "background .2s ease, border-color .2s ease, transform .25s ease",
      transform: on ? "translateY(-2px)" : "translateY(0)",
      boxShadow: on ? `0 12px 28px -10px ${s.accent}33` : "none",
    }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <span className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", color: on ? s.accent : "var(--muted)" }}>
          STAGE {s.n}
        </span>
        <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.16em", color: "var(--light)" }}>
          {s.k}
        </span>
      </div>

      {/* Mini visual representation */}
      <div style={{
        height: 76, marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <StageVisual idx={i} active={on} accent={s.accent} />
      </div>

      <div className="serif" style={{
        fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em",
        color: on ? "var(--ink)" : "var(--ink-soft)",
        lineHeight: 1.1, marginBottom: 4,
      }}>
        {s.label}
      </div>
      <div className="mono" style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: "0.08em", color: "var(--muted)" }}>
        {s.sub}
      </div>
    </button>
  );
}

function PipeArrow({ on }) {
  return (
    <div className="pipe-arrow-h" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="36" height="14" viewBox="0 0 36 14" fill="none">
        <line x1="0" y1="7" x2="28" y2="7"
          stroke={on ? "var(--ink)" : "var(--line-strong)"}
          strokeWidth="1.5"
          className={on ? "dash-march" : ""}
          strokeDasharray="4 6"
        />
        <path d={`M 26 2 L 34 7 L 26 12`} stroke={on ? "var(--ink)" : "var(--line-strong)"} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

/* Mini visualizations for each pipeline stage */
function StageVisual({ idx, active, accent }) {
  if (idx === 0) {
    // INGEST: stack of paper rectangles
    return (
      <div style={{ position: "relative", width: 64, height: 60 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            position: "absolute",
            top: i * 4, left: i * 5,
            width: 44, height: 56,
            background: "var(--white)",
            border: "1px solid var(--line-strong)",
            borderRadius: 2,
            transform: `rotate(${(i - 1.5) * 4}deg)`,
            transformOrigin: "center",
            transition: "transform .3s ease",
            display: "flex", flexDirection: "column", gap: 3,
            padding: "8px 6px",
          }}>
            <div style={{ height: 2, background: "var(--line)", width: "70%" }}/>
            <div style={{ height: 2, background: "var(--line)", width: "90%" }}/>
            <div style={{ height: 2, background: "var(--line)", width: "60%" }}/>
            <div style={{ height: 2, background: "var(--line)", width: "80%" }}/>
            <div style={{ height: 2, background: "var(--line)", width: "55%" }}/>
            {i === 0 && <span className="mono" style={{ position: "absolute", bottom: 3, right: 4, fontSize: 6, fontWeight: 700, color: "var(--muted)" }}>PDF</span>}
            {i === 3 && <span className="mono" style={{ position: "absolute", bottom: 3, right: 4, fontSize: 6, fontWeight: 700, color: "var(--muted)" }}>MD</span>}
          </div>
        ))}
      </div>
    );
  }
  if (idx === 1) {
    // PARSE: doc → { } JSON
    return (
      <div className="row gap-2" style={{ alignItems: "center" }}>
        <div style={{
          width: 36, height: 48,
          background: "var(--white)",
          border: `1px solid ${active ? accent : "var(--line-strong)"}`,
          borderRadius: 2,
          display: "flex", flexDirection: "column", gap: 3,
          padding: "6px 5px",
        }}>
          <div style={{ height: 2, background: "var(--line)", width: "80%" }}/>
          <div style={{ height: 2, background: "var(--line)", width: "60%" }}/>
          <div style={{ height: 2, background: "var(--line)", width: "90%" }}/>
          <div style={{ height: 2, background: "var(--line)", width: "50%" }}/>
        </div>
        <span className="mono" style={{ fontSize: 14, color: active ? accent : "var(--muted)", fontWeight: 600 }}>→</span>
        <pre className="mono" style={{
          margin: 0, fontSize: 8.5, lineHeight: 1.45,
          color: active ? "var(--ink)" : "var(--muted)",
          background: "var(--white)",
          border: `1px solid ${active ? accent : "var(--line-strong)"}`,
          padding: "6px 8px",
          borderRadius: 2,
        }}>{`{
  name:
  stack: [
  years:
}`}</pre>
      </div>
    );
  }
  if (idx === 2) {
    // PROCESS: 2×4 grid of glyphs
    const glyphs = ["#", "Δ", "⊂", "↕", "Y", "≈", "≡", "★"];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, width: 132 }}>
        {glyphs.map((g, i) => (
          <span key={i} className="mono" style={{
            width: 28, height: 28,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--f-serif)",
            fontWeight: 600,
            fontSize: 14,
            border: `1px solid ${active ? accent : "var(--line-strong)"}`,
            color: active ? accent : "var(--muted)",
            background: "var(--white)",
            transform: active ? `scale(${1 + Math.sin(i * 0.8) * 0.05})` : "scale(1)",
            transition: "all .3s ease",
          }}>{g}</span>
        ))}
      </div>
    );
  }
  // COMPARE: 3 colored columns
  return (
    <div className="row gap-1" style={{ alignItems: "flex-end" }}>
      {[
        { c: "var(--a-blue)", h: 56 },
        { c: "var(--a-orange)", h: 48 },
        { c: "var(--a-green)", h: 62 },
      ].map((col, i) => (
        <div key={i} style={{ width: 24, height: col.h, display: "flex", flexDirection: "column", borderRadius: 1, overflow: "hidden", border: "1px solid var(--line-strong)" }}>
          <div style={{ height: 4, background: col.c }}/>
          <div style={{ flex: 1, background: "var(--white)", display: "flex", flexDirection: "column", padding: "4px 3px", gap: 2 }}>
            <div style={{ height: 1.5, background: "var(--line)", width: "70%" }}/>
            <div style={{ height: 1.5, background: "var(--line)", width: "90%" }}/>
            <div style={{ height: 1.5, background: "var(--line)", width: "55%" }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineDetail({ stage, index }) {
  return (
    <div key={stage.n} style={{
      background: "var(--paper)",
      borderTop: `2px solid ${stage.accent}`,
      borderLeft: "1px solid var(--line)",
      borderRight: "1px solid var(--line)",
      borderBottom: "1px solid var(--line)",
      padding: "28px 32px",
      display: "grid",
      gridTemplateColumns: "120px 1fr auto",
      gap: 40,
      alignItems: "center",
      animation: "detail-in .35s cubic-bezier(0.22, 1, 0.36, 1)",
      boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 14px 30px -14px rgba(60,50,30,.10)",
    }} className="pipe-detail">
      <style>{`
        @keyframes detail-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (max-width: 720px) {
          .pipe-detail { grid-template-columns: 1fr !important; gap: 16px !important; padding: 20px !important; }
        }
      `}</style>
      <div className="col gap-1">
        <span className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", color: stage.accent }}>
          STAGE {stage.n}
        </span>
        <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em" }}>
          {stage.label}
        </span>
      </div>
      <p className="serif" style={{ fontSize: 17, lineHeight: 1.55, color: "var(--ink)", letterSpacing: "-0.008em", textWrap: "pretty" }}>
        {stage.detail}
      </p>
      <div className="row gap-2" style={{ alignItems: "center" }}>
        {PIPE_STAGES.map((_, i) => (
          <span key={i} style={{
            width: i === index ? 22 : 6, height: 6,
            background: i === index ? stage.accent : "var(--line-strong)",
            borderRadius: 2,
            transition: "all .25s ease",
          }}/>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   04 — INTERFACE (product spread — embedded sample)
============================================================ */
function Interface() {
  const ref = useReveal();
  return (
    <section id="interface" style={{ background: "var(--desk-deep)", padding: "132px 0 132px" }}>
      <div className="shell">
        <SectionHeader
          refEl={ref}
          num="§ 01"
          label="Interface"
          title={<>한 책상 위에 펼친<br /><em>지원자 24명</em>의 종이 묶음.</>}
          desc="좌측은 인덱스 카드. 우측은 컬러 띠로 구분된 문서들. 매칭 키워드는 노란 펜으로, 유사 문장은 주황색 줄로." />
        

        <div className="sheet reveal reveal-scale" style={{ "--rd": "120ms", marginTop: 40, padding: 0, overflow: "hidden" }}>
          <InterfaceSpread />
        </div>

        <div className="row between wrap gap-3" style={{ marginTop: 16 }}>
          <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", color: "var(--a-blue)", textTransform: "uppercase" }}>
            ➜ 좌측 지원자를 클릭해 볼 수 있습니다 · click rows to switch documents
          </span>
          <p className="serif" style={{ fontSize: 14, color: "var(--ink-soft)", fontStyle: "italic", textAlign: "right", maxWidth: 520 }}>
            ↑ 매칭률 56 %인 김철수의 자기소개에서 박지훈과 유사 구간이 자동 감지된 모습.
          </p>
        </div>
      </div>
    </section>);

}

/* Spread — interactive document review UI */
const ROSTER = [
{ n: "01", name: "김철수", meta: "프론트 · 4년 · Seoul",
  role: "Frontend Engineer — Component thinker.",
  loc: "Seoul ● 4 Years ● Kakao", score: 56, status: "PASS", color: "orange",
  tags: ["React", "TS", "Python"],
  note: "React + TS 강점, Python 미흡. 자기소개 일부 유사구간.",
  alert: "박지훈과 자기소개 1문장 유사 (Rabin-Karp · 87% match)",
  bio: <>
      <span className="sim">안녕하세요. 사용자 경험을 최우선으로 생각하는</span>{" "}
      <span className="hl">React</span> 개발자입니다.{" "}
      <span className="hl">TypeScript</span>와 <span className="hl">Next.js</span>를 주력으로,{" "}
      <span className="sim">컴포넌트 기반 설계와 성능 최적화에 깊은 관심</span>이 있습니다.
    </>,
  stack: [{ name: "React", m: true }, { name: "TypeScript", m: true }, { name: "Next.js", m: true }, { name: "Python", m: false }, { name: "GraphQL", m: false }]
},
{ n: "02", name: "박지훈", meta: "풀스택 · 2년 · Busan",
  role: "Fullstack — Frontend × Backend balanced.",
  loc: "Busan ● 2 Years ● Naver", score: 34, status: "HOLD", color: "red",
  tags: ["React", "Python", "Docker"],
  note: "React+Python 보유, TS 미보유. 유사 구간 감지.",
  alert: "김철수와 자기소개 1문장 유사 (Rabin-Karp · 87% match)",
  bio: <>
      <span className="sim">안녕하세요. 사용자 경험을 최우선으로 생각하는</span>{" "}
      <span className="hl">React</span> 및 <span className="hl">Python</span> 개발자입니다.{" "}
      <span className="sim">컴포넌트 기반 설계와 성능 최적화에 깊은 관심</span>이 있습니다.
    </>,
  stack: [{ name: "React", m: true }, { name: "JavaScript", m: false }, { name: "Python", m: true }, { name: "Django", m: false }, { name: "Docker", m: false }]
},
{ n: "03", name: "이민준", meta: "백엔드 · 3년 · Seoul",
  role: "Backend Engineer — Distributed systems.",
  loc: "Seoul ● 3 Years ● LINE", score: 28, status: "REVIEW", color: "muted",
  tags: ["Python", "Java"],
  note: "Python 강점, React 미보유. 직무 미스매치.",
  alert: null,
  bio: <>Java Spring Boot와 <span className="hl">Python</span>을 중심으로 대용량 트래픽 처리 경험. MSA 아키텍처 설계 및 운영 3년차. <span className="hl">TypeScript</span> 기초 보유.</>,
  stack: [{ name: "Python", m: true }, { name: "Java", m: false }, { name: "Spring", m: false }, { name: "TypeScript", m: true }, { name: "Kubernetes", m: false }]
},
{ n: "04", name: "박도현", meta: "풀스택 · 6년 · Seoul",
  role: "Senior Fullstack — Product owner mindset.",
  loc: "Seoul ● 6 Years ● Toss", score: 72, status: "PASS", color: "green",
  tags: ["React", "TS", "Python"],
  note: "전 영역 보유. 시니어급 매칭.",
  alert: null,
  bio: <>제품 전반의 의사결정을 책임지는 시니어 풀스택입니다. <span className="hl">React</span>, <span className="hl">TypeScript</span>, <span className="hl">Python</span>을 주력으로, 백오피스부터 결제 시스템까지 운영했습니다.</>,
  stack: [{ name: "React", m: true }, { name: "TypeScript", m: true }, { name: "Next.js", m: true }, { name: "Python", m: true }, { name: "AWS", m: false }]
}];


function InterfaceSpread() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = ROSTER[activeIdx];
  const pair = ROSTER[(activeIdx + 1) % ROSTER.length];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: 540 }} className="iface-grid">
      {/* Left desk */}
      <div style={{ borderRight: "1px solid var(--line)", background: "var(--white)" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--line-faint)" }}>
          <div className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.22em", color: "var(--muted)", textTransform: "uppercase" }}>
            <span style={{ color: "var(--a-blue)" }}>◆</span>&nbsp; Reviewer / v0.4
          </div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink)", marginTop: 6 }}>
            프론트엔드 개발자
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, letterSpacing: "0.04em" }}>
            지원자 24명 · 검토 중 7명
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line-faint)" }}>
          <div className="smcaps" style={{ marginBottom: 8 }}>Required</div>
          <div className="row wrap gap-1">
            <span className="chip blue">React ✕</span>
            <span className="chip blue">TypeScript ✕</span>
            <span className="chip green">Python ✕</span>
            <span className="chip" style={{ borderStyle: "dashed", color: "var(--light)" }}>＋ 추가</span>
          </div>
        </div>

        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line-faint)", position: "relative" }}>
          <div className="row gap-2" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>⌕</span>
            <span className="serif" style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink)" }}>이름·키워드 검색</span>
            <span className="blink-caret" style={{ color: "var(--ink)", fontWeight: 600 }}>|</span>
          </div>
        </div>

        <div style={{ padding: "10px 20px 0", display: "flex", gap: 14, fontSize: 10.5, fontFamily: "var(--f-mono)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <span style={{ color: "var(--ink)", borderBottom: "2px solid var(--ink)", paddingBottom: 6 }}>전체</span>
          <span style={{ color: "var(--light)" }}>통과</span>
          <span style={{ color: "var(--light)" }}>보류</span>
          <span style={{ color: "var(--light)", marginLeft: "auto" }}>12 / 24</span>
        </div>

        {/* rows */}
        {ROSTER.map((r, i) => {
          const isActive = i === activeIdx;
          return (
            <button key={r.n}
            onClick={() => setActiveIdx(i)}
            style={{
              all: "unset", cursor: "pointer", display: "block", width: "100%",
              padding: "12px 20px",
              borderBottom: "1px solid var(--line-faint)",
              background: isActive ? "var(--paper)" : "transparent",
              borderLeft: isActive ? "3px solid var(--a-blue)" : "3px solid transparent",
              paddingLeft: isActive ? 17 : 20,
              transition: "background .15s ease, border-left-color .15s ease"
            }}
            onMouseEnter={(e) => {if (!isActive) e.currentTarget.style.background = "var(--rail)";}}
            onMouseLeave={(e) => {if (!isActive) e.currentTarget.style.background = "transparent";}}>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--light)", letterSpacing: "0.05em" }}>{r.n}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>{r.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 1 }}>{r.meta}</div>
                  <div className="row wrap gap-1" style={{ marginTop: 6 }}>
                    {r.tags.map((t) => <span key={t} className="chip match" style={{ fontSize: 9.5, padding: "1px 6px" }}>{t}</span>)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{
                    fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em",
                    color: r.score >= 60 ? "var(--a-green)" : r.score >= 40 ? "var(--a-orange)" : "var(--a-red)"
                  }}>{r.score}</div>
                  <div className="mono" style={{
                    fontSize: 8.5, fontWeight: 600, letterSpacing: "0.14em", marginTop: 4,
                    color: r.status === "PASS" ? "var(--a-green)" : r.status === "HOLD" ? "var(--a-orange)" : "var(--muted)",
                    background: r.status === "PASS" ? "rgba(45,198,83,.07)" : r.status === "HOLD" ? "rgba(247,103,7,.07)" : "var(--rail)",
                    padding: "2px 5px"
                  }}>{r.status}</div>
                </div>
              </div>
            </button>);

        })}
      </div>

      {/* Right document stage */}
      <div style={{ background: "var(--desk)", padding: "16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, overflow: "hidden", position: "relative" }}>
        {/* tab bar */}
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
          <DocTab idx={active.n} name={active.name} score={active.score} on />
          <DocTab idx={pair.n} name={pair.name} score={pair.score} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", padding: "4px 10px" }}>
            <span className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: "var(--ink)", background: "var(--paper)", padding: "3px 7px", border: "1px solid var(--line)" }}>COMPARE</span>
            <span className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: "var(--muted)" }}>STACK</span>
            <span className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: "var(--muted)" }}>⌕ FIND</span>
          </div>
        </div>

        <DocCardLive key={active.n} c={active} idx={1} />
        <DocCardLive key={pair.n + "-p"} c={pair} idx={2} />
      </div>
      <style>{`
        @media (max-width: 880px) {
          .iface-grid { grid-template-columns: 1fr !important; }
          .iface-grid > div:last-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>);

}

function DocTab({ idx, name, score, on }) {
  return (
    <div style={{
      padding: "10px 12px 8px", minWidth: 160,
      display: "flex", alignItems: "center", gap: 8,
      background: on ? "var(--paper)" : "transparent",
      borderTop: on ? "2px solid var(--a-blue)" : "2px solid transparent",
      cursor: "pointer"
    }}>
      <span className="mono" style={{ fontSize: 9, color: "var(--light)", letterSpacing: "0.1em" }}>{idx} /</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{name}</span>
      <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--a-blue)", marginLeft: "auto" }}>{score}</span>
    </div>);

}

/* Animated score count-up */
function useCountUp(target, dur = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let start;const from = 0;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return n;
}

function DocCardLive({ c, idx }) {
  const accent = c.color === "orange" ? "var(--a-orange)" :
  c.color === "green" ? "var(--a-green)" :
  c.color === "red" ? "var(--a-red)" :
  "var(--a-blue)";
  const score = useCountUp(c.score, 700);
  return (
    <article style={{
      background: "var(--paper)",
      boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 8px 18px -6px rgba(60,50,30,.10)",
      borderLeft: `4px solid ${accent}`,
      padding: "16px 18px 18px",
      minWidth: 0,
      display: "flex", flexDirection: "column",
      animation: "card-in .35s ease"
    }}>
      <style>{`@keyframes card-in { from { opacity:0; transform: translateY(8px);} to {opacity:1; transform:none;} }`}</style>
      <div className="row gap-2" style={{ marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: accent }}>CANDIDATE {c.n}</span>
        <span className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase" }}>· {c.meta.replace(/·/g, "·")}</span>
      </div>
      <h3 className="display" style={{ fontSize: 30, letterSpacing: "-0.035em", lineHeight: 0.95, marginTop: 4 }}>{c.name}</h3>
      <p className="serif" style={{ fontSize: 12, fontStyle: "italic", color: "var(--muted)", marginTop: 4 }}>{c.role}</p>
      <div className="mono" style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "0.12em", color: "var(--ink-soft)", textTransform: "uppercase", padding: "10px 0 12px", borderBottom: "2px solid var(--ink)", marginBottom: 14 }}>
        {c.loc}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", padding: "10px 12px", background: "var(--white)", border: "1px solid var(--line-faint)", marginBottom: 12 }}>
        <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: accent, letterSpacing: "-0.04em", lineHeight: 1, gridRow: "1 / 3", alignSelf: "center" }}>
          {score}<span style={{ fontSize: 11, opacity: 0.5 }}>%</span>
        </div>
        <span className="smcaps">Match score</span>
        <span style={{ fontSize: 10.5, color: "var(--ink-soft)", lineHeight: 1.4 }}>{c.note}</span>
      </div>

      {c.alert &&
      <div style={{ display: "flex", gap: 8, padding: "8px 10px", background: "var(--tint-orange)", borderLeft: "2px solid var(--a-orange)", marginBottom: 12 }}>
          <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em", color: "var(--a-orange)" }}>⚠ ALERT</span>
          <span style={{ fontSize: 10.5, color: "var(--ink-soft)", lineHeight: 1.4 }}>{c.alert}</span>
        </div>
      }

      <div className="smcaps" style={{ marginBottom: 6, color: "var(--ink)" }}>자기소개 · § 01</div>
      <p className="serif" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink)", marginBottom: 14 }}>{c.bio}</p>

      <div className="smcaps" style={{ marginBottom: 6, color: "var(--ink)" }}>기술 스택 · § 02</div>
      <div className="row wrap gap-1">
        {c.stack.map((s) => <span key={s.name} className={"chip" + (s.m ? " match" : "")} style={{ fontSize: 9.5, padding: "2px 7px" }}>{s.name}</span>)}
      </div>
    </article>);

}

/* ============================================================
   Section Header (shared)
============================================================ */
function SectionHeader({ refEl, num, label, title, desc }) {
  return (
    <div ref={refEl} className="sh-grid" style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 56 }}>
      <style>{`@media (max-width: 880px) { .sh-grid { grid-template-columns: 1fr !important; gap: 20px !important; } }`}</style>
      <div className="col gap-2 reveal reveal-left">
        <span className="smcaps" style={{ color: "var(--ink)" }}>{num} · {label}</span>
        <div className="rule-thin" style={{ width: 56, background: "var(--ink)", height: 2 }} />
      </div>
      <div>
        <h2 className="display reveal" style={{ fontSize: "clamp(36px, 5.5vw, 64px)", lineHeight: 0.98 }}>{title}</h2>
        {desc && <p className="serif reveal" style={{ "--rd": "120ms", marginTop: 18, fontSize: 16, lineHeight: 1.5, color: "var(--ink-soft)", maxWidth: 620, fontStyle: "italic" }}>{desc}</p>}
      </div>
    </div>);

}

/* ============================================================
   05 — METHOD  (numbered editorial list of algorithms)
============================================================ */
const STEPS = [
{ n: "01", title: "Solar LLM", week: "—", color: "blue",
  sub: "정보 추출 · 정형화",
  body: <>PDF·MD·TXT 포트폴리오에서 이름·기술스택·경력·프로젝트·학력을 <span className="hl">JSON</span>으로 정형화. 이후 모든 알고리즘이 이 정형화된 데이터를 입력으로 받는다.</>,
  code: `{\n  "name": "홍길동",\n  "stack": ["React", "Python", "Docker"],\n  "years": 3,\n  ...\n}` },
{ n: "02", title: "Hash Table", week: "10주차", color: "blue",
  sub: "O(1) 매칭 탐지",
  body: <>필요 스펙 키워드를 <span className="hl">해시셋</span>에 저장해 지원자 스펙을 O(1)로 조회. 매칭된 스펙은 노란 펜으로 하이라이트된다.</>,
  code: `required = {"React","Python","Docker"}\n"Python" in required   →   O(1)  ✓` },
{ n: "03", title: "Alias Hashmap + Edit Distance", week: "6 · 10주차", color: "green",
  sub: "표기 차이 · 오타 흡수",
  body: <>「ReactJS ↔ React」, 「파이선 ↔ 파이썬」같은 표기 차이와 오타를 <span className="hl">별칭 해시맵 + DP</span>로 흡수해 통합 매칭한다.</>,
  code: `aliasMap["python"] = ["py","파이썬","파이선"]\nedit("파이선","파이썬") = 1   →   match` },
{ n: "04", title: "LCS (DP)", week: "6주차", color: "orange",
  sub: "매칭 점수 산출",
  body: <>필요 스펙과 지원자 스펙 시퀀스의 <span className="hl">최장 공통 부분(LCS)</span>을 계산해 정량적 매칭 점수를 부여한다.</>,
  code: `required:  [React, Python, Docker, AWS, Git]\napplicant: [React, Vue, Python, Git, Linux]\nLCS = 3   →   3/5 = 60%` },
{ n: "05", title: "Sorting", week: "3주차", color: "orange",
  sub: "지원자 순위 결정",
  body: <>매칭률·경력·이름·접수일 등 인사담당자가 지정한 기준으로 카드를 <span className="hl">즉시 재배치</span>한다.</>,
  code: `sortBy: "match"\n→ [김철수 56, 박지훈 34, 이민준 28]` },
{ n: "06", title: "BST", week: "9주차", color: "blue",
  sub: "키워드 검색 · 필터링",
  body: <>토큰 단위 <span className="hl">이진 탐색 트리</span>로 키워드 위치를 O(log n)에 탐색. 전체 지원자 / 단일 포트폴리오 내부 검색 모두 처리.</>,
  code: `tree.find("Docker")\n→ applicantA · §03 · "Docker 환경에서…"` },
{ n: "07", title: "Rabin-Karp + LCS", week: "6주차", color: "orange",
  sub: "유사 문장 검출",
  body: <>포트폴리오 간 <span className="hl">유사 문장을 롤링 해시</span>로 감지해 동일 색상 줄로 표시. 토글로 숨기거나 보일 수 있다.</>,
  code: `hash("저는 사용자 경험을 최우선…")\n→ match in applicantC (sim 0.87)` }];


function Method() {
  const ref = useReveal();
  const [activeStep, setActiveStep] = useState(0);
  return (
    <section id="method" style={{ background: "var(--desk)", padding: "132px 0 132px" }}>
      <div className="shell">
        <SectionHeader
          refEl={ref}
          num="§ 02"
          label="Method"
          title={<>입력에서 정렬된 결과까지,<br /><em>일곱 개의 기능 단계</em>로.</>}
          desc="여덟 가지 알고리즘이 일곱 기능 단계로 조합된다. 각 단계는 자료구조 수업의 한 챕터에 대응하며, 옆 번호는 강의 주차다. 단계를 클릭해보세요." />
        

        <ol style={{ marginTop: 48, listStyle: "none", padding: 0 }}>
          {STEPS.map((s, i) => <MethodRow key={s.n} s={s} i={i} active={activeStep === i} onClick={() => setActiveStep(i)} />)}
        </ol>
      </div>
    </section>);

}

function MethodRow({ s, i, active, onClick }) {
  const accent = s.color === "blue" ? "var(--a-blue)" : s.color === "orange" ? "var(--a-orange)" : "var(--a-green)";
  return (
    <li onClick={onClick} style={{
      borderTop: "1px solid var(--line)",
      padding: "32px 0",
      display: "grid",
      gridTemplateColumns: "200px 1fr 360px",
      gap: 56,
      alignItems: "start",
      cursor: "pointer",
      background: active ? "var(--white)" : "transparent",
      marginLeft: active ? -24 : 0,
      marginRight: active ? -24 : 0,
      paddingLeft: active ? 24 : 0,
      paddingRight: active ? 24 : 0,
      transition: "all .25s cubic-bezier(0.22, 1, 0.36, 1)",
      boxShadow: active ? "0 1px 0 rgba(0,0,0,.04), 0 18px 36px -16px rgba(60,50,30,.14)" : "none"
    }} className="method-row reveal reveal-rise">
      <div className="col gap-2" style={{ paddingLeft: 14, borderLeft: `4px solid ${accent}`, transform: active ? "translateX(4px)" : "none", transition: "transform .25s ease" }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: accent, letterSpacing: "0.16em" }}>
          STEP {s.n} {active && <span style={{ marginLeft: 4 }}>▸</span>}
        </span>
        <span className="serif" style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>{s.week}</span>
      </div>
      <div>
        <h3 className="display" style={{ fontSize: 36, letterSpacing: "-0.025em", lineHeight: 1.0, marginBottom: 4 }}>
          {s.title}
        </h3>
        <div className="serif" style={{ fontSize: 16, fontStyle: "italic", color: accent, marginBottom: 12 }}>
          {s.sub}
        </div>
        <p className="serif" style={{ fontSize: 16, lineHeight: 1.55, color: "var(--ink)", maxWidth: 580, textWrap: "pretty" }}>
          {s.body}
        </p>
      </div>
      <pre className="mono" style={{
        margin: 0,
        background: "var(--ink)",
        color: "#E8E4D8",
        padding: "18px 20px",
        fontSize: 11.5,
        lineHeight: 1.65,
        whiteSpace: "pre",
        overflow: "auto",
        boxShadow: active ?
        `0 1px 0 rgba(0,0,0,.04), 0 16px 32px -8px ${s.color === 'blue' ? 'rgba(67,97,238,.32)' : s.color === 'orange' ? 'rgba(247,103,7,.32)' : 'rgba(45,198,83,.32)'}` :
        "0 1px 0 rgba(0,0,0,.04), 0 8px 18px -6px rgba(60,50,30,.16)",
        borderLeft: `4px solid ${accent}`,
        transform: active ? "translateY(-2px)" : "none",
        transition: "all .25s ease"
      }}>{s.code}</pre>
      <style>{`
        @media (max-width: 980px) {
          .method-row { grid-template-columns: 1fr !important; gap: 20px !important; }
        }
      `}</style>
    </li>);

}

/* ============================================================
   06 — DEMO  (interactive matching)
============================================================ */
const DEMO_PORTFOLIOS = [
{ name: "김지수", years: 3, color: "blue",
  stack: ["React", "TypeScript", "Python", "Docker", "AWS", "PostgreSQL"],
  text: "저는 사용자 중심의 인터페이스를 설계하며 React와 TypeScript로 대규모 SPA를 구축한 경험이 있습니다. 백엔드는 Python(FastAPI)을 사용했고, Docker 컨테이너로 AWS ECS에 배포했습니다." },
{ name: "이민준", years: 2, color: "orange",
  stack: ["React", "Vue", "Python", "Git", "Linux"],
  text: "프론트엔드는 React와 Vue를 모두 다루며, 사이드 프로젝트에서는 ReactJS로 SSR 환경을 직접 구성했습니다. 백엔드는 파이선으로 작은 서비스를 만들었습니다." },
{ name: "박서연", years: 4, color: "green",
  stack: ["Java", "Spring", "Python", "MySQL", "Kafka"],
  text: "Java/Spring 기반의 백엔드 시스템을 4년간 운영했습니다. 데이터 파이프라인에는 파이썬을 사용했고, 메시지 브로커로 Kafka를 도입해 처리량을 5배 개선했습니다." }];

const ALIAS = {
  react: ["react", "reactjs", "react.js"],
  python: ["python", "파이썬", "파이선", "py"],
  docker: ["docker"],
  typescript: ["typescript", "ts"],
  aws: ["aws"], java: ["java"], spring: ["spring"], vue: ["vue", "vuejs"],
  kafka: ["kafka"], git: ["git"], mysql: ["mysql"], next: ["next.js", "nextjs", "next"]
};
function aliasesFor(q) {
  const k = q.trim().toLowerCase();
  if (!k) return [];
  for (const key in ALIAS) if (ALIAS[key].includes(k) || key === k) return ALIAS[key];
  return [k];
}
function ed(a, b) {
  a = a.toLowerCase();b = b.toLowerCase();
  if (a === b) return 0;
  const m = a.length,n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
  dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
function isMatch(token, queries) {
  if (!queries.length) return false;
  const t = token.toLowerCase();
  return queries.some((q) => t === q || ed(t, q) <= 1);
}
function HighlightedText({ text, queries }) {
  if (!queries.length) return <>{text}</>;
  const parts = text.split(/([\s,.()/\-]+)/);
  return <>{parts.map((p, i) => {
      if (!p) return null;
      if (/^[\s,.()/\-]+$/.test(p)) return <React.Fragment key={i}>{p}</React.Fragment>;
      const core = p.replace(/[^\p{L}\p{N}.]/gu, "");
      if (core && isMatch(core, queries)) return <mark key={i} className="hl">{p}</mark>;
      return <React.Fragment key={i}>{p}</React.Fragment>;
    })}</>;
}

function Demo() {
  const ref = useReveal();
  const [query, setQuery] = useState("React, Python");
  const queries = useMemo(() => {
    const tokens = query.split(/[,\s]+/).filter(Boolean);
    const all = new Set();
    tokens.forEach((t) => aliasesFor(t).forEach((a) => all.add(a.toLowerCase())));
    return Array.from(all);
  }, [query]);
  const scored = useMemo(() => {
    const required = query.split(/[,\s]+/).filter(Boolean);
    return DEMO_PORTFOLIOS.map((p) => {
      let matched = 0;
      required.forEach((q) => {
        const a = aliasesFor(q);
        const found = p.stack.some((s) => isMatch(s, a)) || a.some((x) => p.text.toLowerCase().includes(x));
        if (found) matched++;
      });
      const score = required.length ? Math.round(matched / required.length * 100) : 0;
      return { ...p, score };
    }).sort((a, b) => b.score - a.score);
  }, [query]);
  const suggestions = ["React, Python", "TypeScript, Docker, AWS", "파이선, ReactJS", "Java, Spring, Kafka"];

  return (
    <section id="demo" style={{ background: "var(--desk-deep)", padding: "132px 0 132px" }}>
      <div className="shell">
        <SectionHeader
          refEl={ref}
          num="§ 03"
          label="Live Demo"
          title={<>필요 스펙을 입력하면,<br /><em>실시간으로</em> 매칭된다.</>}
          desc="오타·표기 차이도 별칭 해시맵과 Edit Distance가 잡아낸다. 「파이선」을 쳐 보라." />
        

        <div className="sheet reveal reveal-scale" style={{ "--rd": "120ms", marginTop: 40, padding: 24 }}>
          {/* Search bar */}
          <div className="row gap-3 wrap" style={{ paddingBottom: 18, borderBottom: "1px solid var(--line)" }}>
            <div className="row gap-2" style={{
              flex: "1 1 320px", background: "var(--white)", border: "1px solid var(--line-strong)",
              padding: "10px 14px", minHeight: 44
            }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.12em" }}>QUERY ▸</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="React, Python, Docker…" style={{
                all: "unset", flex: 1, fontFamily: "var(--f-mono)", fontSize: 14, color: "var(--ink)"
              }} />
              {query &&
              <button onClick={() => setQuery("")} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "var(--muted)" }}>지우기</button>
              }
            </div>
            <div className="row gap-2 wrap">
              {suggestions.map((s) =>
              <button key={s} onClick={() => setQuery(s)} className="chip" style={{
                background: query === s ? "var(--ink)" : "var(--white)",
                color: query === s ? "var(--paper)" : "var(--ink-soft)",
                borderColor: query === s ? "var(--ink)" : "var(--line)",
                cursor: "pointer", padding: "4px 9px"
              }}>{s}</button>
              )}
            </div>
          </div>

          {/* Result columns */}
          <div style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14
          }} className="demo-grid">
            {scored.map((p, i) => <RevealItem key={p.name} delay={i * 70} variant="reveal-scale"><DemoCard p={p} queries={queries} rank={i} /></RevealItem>)}
          </div>

          <div className="row gap-6 wrap" style={{ marginTop: 22, fontSize: 11, color: "var(--muted)" }}>
            <span className="mono" style={{ letterSpacing: "0.1em" }}>· HASH SET → O(1) MATCH</span>
            <span className="mono" style={{ letterSpacing: "0.1em" }}>· EDIT DISTANCE ≤ 1</span>
            <span className="mono" style={{ letterSpacing: "0.1em" }}>· LCS SCORE → SORT</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 880px) { .demo-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>);

}

function DemoCard({ p, queries, rank }) {
  const isTop = rank === 0 && p.score > 0;
  const accent = p.color === "blue" ? "var(--a-blue)" : p.color === "orange" ? "var(--a-orange)" : "var(--a-green)";
  const scoreColor = p.score >= 80 ? "var(--a-green)" : p.score >= 40 ? "var(--a-orange)" : "var(--muted)";
  const score = useCountUp(p.score, 600);
  return (
    <article style={{
      background: "var(--paper)",
      borderLeft: `4px solid ${accent}`,
      boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 6px 14px -6px rgba(60,50,30,.10)",
      padding: 20,
      position: "relative",
      animation: "card-in .35s ease",
      transition: "transform .2s ease, box-shadow .2s ease"
    }}
    onMouseEnter={(e) => {e.currentTarget.style.transform = "translateY(-3px)";e.currentTarget.style.boxShadow = "0 1px 0 rgba(0,0,0,.04), 0 16px 30px -10px rgba(60,50,30,.16)";}}
    onMouseLeave={(e) => {e.currentTarget.style.transform = "translateY(0)";e.currentTarget.style.boxShadow = "0 1px 0 rgba(0,0,0,.04), 0 6px 14px -6px rgba(60,50,30,.10)";}}>
      {isTop &&
      <span className="mono" style={{
        position: "absolute", top: -10, left: 18,
        background: "var(--ink)", color: "var(--paper)",
        fontSize: 9, fontWeight: 600, letterSpacing: "0.16em",
        padding: "3px 9px"
      }}>TOP MATCH</span>
      }
      <div className="row between start">
        <div>
          <div className="mono" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: accent }}>
            CANDIDATE 0{rank + 1}
          </div>
          <h3 className="display" style={{ fontSize: 28, letterSpacing: "-0.03em", lineHeight: 0.95, marginTop: 4 }}>{p.name}</h3>
          <div className="serif" style={{ fontSize: 12, fontStyle: "italic", color: "var(--muted)", marginTop: 2 }}>경력 {p.years}년</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 30, fontWeight: 600, color: scoreColor, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {score}<span style={{ fontSize: 14 }}>%</span>
          </div>
          <div className="smcaps" style={{ marginTop: 2 }}>Match</div>
        </div>
      </div>

      <div className="mono" style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", color: "var(--ink-soft)", textTransform: "uppercase", padding: "12px 0 8px", borderBottom: "2px solid var(--ink)", marginTop: 14, marginBottom: 14 }}>
        Stack ● Self-introduction
      </div>

      <div className="row wrap gap-1" style={{ marginBottom: 14 }}>
        {p.stack.map((s) => <span key={s} className={"chip" + (isMatch(s, queries) ? " match" : "")}>{s}</span>)}
      </div>
      <p className="serif" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>
        <HighlightedText text={p.text} queries={queries} />
      </p>
    </article>);

}

/* ============================================================
   07 — CATALOG  (8 algorithms editorial grid)
============================================================ */
const ALGOS = [
{ n: "01", name: "Solar LLM", role: "포트폴리오 정형화", week: "—", glyph: "★", color: "blue" },
{ n: "02", name: "Hash Table", role: "O(1) 키워드 매칭", week: "10주차", glyph: "#", color: "blue" },
{ n: "03", name: "Edit Distance", role: "오타·표기 흡수", week: "6주차", glyph: "Δ", color: "green" },
{ n: "04", name: "LCS (DP)", role: "매칭 점수 산출", week: "6주차", glyph: "⊂", color: "orange" },
{ n: "05", name: "Sorting", role: "지원자 순위", week: "3주차", glyph: "↕", color: "orange" },
{ n: "06", name: "BST", role: "키워드 빠른 검색", week: "9주차", glyph: "Y", color: "blue" },
{ n: "07", name: "Alias Hashmap", role: "동의어 통합 검색", week: "6·10주차", glyph: "≈", color: "green" },
{ n: "08", name: "Rabin-Karp", role: "유사 문장 검출", week: "6주차", glyph: "≡", color: "orange" }];


function Catalog() {
  const ref = useReveal();
  return (
    <section id="catalog" style={{ background: "var(--desk)", padding: "132px 0 132px" }}>
      <div className="shell">
        <SectionHeader
          refEl={ref}
          num="§ 04"
          label="Algorithms"
          title={<>여덟 가지 알고리즘,<br /><em>자료구조 수업의 색인</em>.</>}
          desc="각 카드 좌측의 컬러 띠는 카테고리. 청색은 탐색·자료구조, 녹색은 문자열 보정, 주황색은 동적 계획법." />
        

        <div style={{
          marginTop: 48,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12
        }} className="algo-grid">
          {ALGOS.map((a, i) => <RevealItem key={a.n} delay={i * 55}><AlgoCard a={a} /></RevealItem>)}
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) { .algo-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 540px) { .algo-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </section>);

}
function AlgoCard({ a }) {
  const accent = a.color === "blue" ? "var(--a-blue)" : a.color === "orange" ? "var(--a-orange)" : "var(--a-green)";
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "var(--white)" : "var(--paper)",
        borderLeft: `4px solid ${accent}`,
        padding: "20px 20px 18px",
        minHeight: 188,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        boxShadow: hover ?
        `0 1px 0 rgba(0,0,0,.04), 0 16px 28px -10px ${a.color === 'blue' ? 'rgba(67,97,238,.22)' : a.color === 'orange' ? 'rgba(247,103,7,.22)' : 'rgba(45,198,83,.22)'}` :
        "0 1px 0 rgba(0,0,0,.03), 0 4px 12px -6px rgba(60,50,30,.08)",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        transition: "transform .25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow .25s ease, background .15s ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden"
      }}>
      {/* hover sweep */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(135deg, transparent 0%, transparent 40%, ${accent}11 100%)`,
        opacity: hover ? 1 : 0, transition: "opacity .25s ease", pointerEvents: "none"
      }} />
      <div className="row between start" style={{ position: "relative" }}>
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: accent, letterSpacing: "0.16em" }}>NO. {a.n}</span>
        <span className="serif" style={{
          fontSize: 28, fontWeight: 600, color: accent, lineHeight: 1,
          display: "inline-block",
          transform: hover ? "rotate(-8deg) scale(1.25)" : "rotate(0) scale(1)",
          transition: "transform .35s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transformOrigin: "center"
        }}>{a.glyph}</span>
      </div>
      <div style={{ position: "relative" }}>
        <h3 className="serif" style={{
          fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em",
          color: hover ? accent : "var(--ink)",
          marginTop: 22, lineHeight: 1.05,
          transition: "color .2s ease"
        }}>
          {a.name}
        </h3>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.45 }}>{a.role}</p>
        <div className="mono" style={{
          fontSize: 9.5, fontWeight: 600, color: "var(--muted)",
          letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 12,
          display: "flex", alignItems: "center", gap: 8
        }}>
          <span>{a.week}</span>
          <span style={{
            opacity: hover ? 1 : 0,
            transform: hover ? "translateX(0)" : "translateX(-6px)",
            transition: "all .25s ease", color: accent
          }}>→ OPEN</span>
        </div>
      </div>
    </div>);

}

/* ============================================================
   08.5 — FEATURES  (bento grid catalog of product features)
============================================================ */
const FEATURES = [
  { col: 2, accent: "blue", glyph: "↑",
    cat: "UPLOAD & PARSE",
    title: "한 번에 폴더째 업로드.",
    desc: "PDF·MD·TXT를 단일 / 폴더 / 드래그&드롭 / 붙여넣기 — Solar LLM이 어떤 입력이든 동일한 스키마로 정형화한다.",
    bullets: ["단일 · 폴더 · 텍스트 붙여넣기", "Solar LLM 자동 파싱 + 진행 단계", "Rabin-Karp 중복 사전 차단"] },
  { col: 2, accent: "green", glyph: "⚙",
    cat: "JOB CONFIG",
    title: "공고만 붙여넣으면, 설정 끝.",
    desc: "Solar가 필요 스펙·가중치·필터를 한 번에 추출. 적용 즉시 전체 지원자 자동 재분석.",
    bullets: ["AI 자동 채용 설정 추출", "기술 · 경력 · 프로젝트 가중치", "사용자 정의 섹션 최대 6개"] },
  { col: 2, accent: "blue", glyph: "⫼",
    cat: "SIDE-BY-SIDE",
    title: "최대 4 패널, 한 책상 위.",
    desc: "사이드바 클릭 순서대로 패널이 나열. 색 띠 구분, 동기화 스크롤, 전체화면, 패널 내 BST 검색까지.",
    bullets: ["4 패널 동시 표시 · 색 띠 구분", "동기화 스크롤 토글", "패널 내 BST 검색 + 하이라이트"] },
  { col: 2, accent: "orange", glyph: "≋",
    cat: "SIMILARITY",
    title: "유사 문장, 색 띠로 그룹화.",
    desc: "Rabin-Karp 롤링 해시 + LCS 검증으로 어느 구간끼리 비슷한지 6개 색 그룹으로 시각화.",
    bullets: ["6 색상 그룹", "흐리게 / 단색 / 컬러풀 팔레트", "패널별 독립 토글"] },
  { col: 1, accent: "orange", glyph: "⇄",
    cat: "DIFF",
    title: "2 ~ 4명 비교.",
    desc: "테이블 그리드 + 좌우 집중 비교 + Solar AI 코멘트.",
    bullets: ["우세 항목 ✓ 표시", "집중 2명 좌우 비교", "A / B / 동등 코멘트"] },
  { col: 1, accent: "green", glyph: "⌕",
    cat: "SEARCH",
    title: "별칭 통합 검색.",
    desc: "py · 파이선 · 파이썬을 같은 검색어로. 전역 + 패널 내 BST 동시 처리.",
    bullets: ["Alias hashmap + Edit Distance", "전역 + intra 동시 하이라이트", "히스토리 8개 localStorage"] },
  { col: 2, accent: "blue", glyph: "▤",
    cat: "VISUALIZATION & WORKFLOW",
    title: "타임라인 · 스킬 매트릭스 · 블라인드.",
    desc: "프로젝트 기간 수평 막대 + 전체 지원자×스킬 그리드 + 무의식적 편향 차단을 위한 별칭 모드.",
    bullets: ["6가지 날짜 형식 자동 파싱", "스킬 그리드 + CSV 내보내기", "블라인드 · 북마크 · 메모 · 세션 export"] },
];

function Features() {
  const ref = useReveal();
  return (
    <section id="features" style={{ background: "var(--white)", padding: "132px 0 132px", borderTop: "1px solid var(--line)" }}>
      <div className="shell">
        <SectionHeader
          refEl={ref}
          num="§ 05"
          label="Features"
          title={<>알고리즘 뒤로 <em>이만큼</em>의 기능.</>}
          desc="자료구조 알고리즘이 매칭·정렬을 처리하는 동안, 인사 담당자의 작업 흐름 전체가 한 페이지 안에서 끝난다."
        />
        <div style={{
          marginTop: 48,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }} className="feat-grid">
          {FEATURES.map((f, i) => <RevealItem key={i} delay={i * 60} style={{ gridColumn: `span ${f.col}` }}><FeatureCard f={f} /></RevealItem>)}
        </div>
      </div>
      <style>{`
        @media (max-width: 980px) {
          .feat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .feat-grid > div { grid-column: span 2 !important; }
        }
        @media (max-width: 540px) {
          .feat-grid { grid-template-columns: 1fr !important; }
          .feat-grid > div { grid-column: span 1 !important; }
        }
      `}</style>
    </section>
  );
}

function FeatureCard({ f }) {
  const accent = f.accent === "blue" ? "var(--a-blue)" : f.accent === "orange" ? "var(--a-orange)" : "var(--a-green)";
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      gridColumn: `span ${f.col}`,
      background: "var(--paper)",
      borderLeft: `4px solid ${accent}`,
      padding: "26px 28px 24px",
      minHeight: 220,
      display: "flex", flexDirection: "column", gap: 14,
      boxShadow: hover
        ? `0 1px 0 rgba(0,0,0,.04), 0 18px 32px -12px rgba(60,50,30,.16)`
        : `0 1px 0 rgba(0,0,0,.04), 0 6px 14px -6px rgba(60,50,30,.10)`,
      transform: hover ? "translateY(-3px)" : "translateY(0)",
      transition: "transform .25s ease, box-shadow .25s ease",
      position: "relative",
      overflow: "hidden",
      cursor: "default",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(135deg, transparent 50%, ${accent}11 100%)`,
        opacity: hover ? 1 : 0, transition: "opacity .25s ease", pointerEvents: "none",
      }}/>
      <div className="row between start" style={{ position: "relative" }}>
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: accent, letterSpacing: "0.2em" }}>{f.cat}</span>
        <span className="serif" style={{
          fontSize: 32, fontWeight: 600, color: accent, lineHeight: 1, opacity: 0.6,
          transform: hover ? "scale(1.15) rotate(-5deg)" : "scale(1) rotate(0)",
          transition: "transform .3s cubic-bezier(0.22, 1, 0.36, 1)",
          transformOrigin: "center",
        }}>{f.glyph}</span>
      </div>
      <h3 className="serif" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--ink)", lineHeight: 1.1, position: "relative" }}>
        {f.title}
      </h3>
      <p className="serif" style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--ink-soft)", marginTop: -4, textWrap: "pretty", position: "relative" }}>
        {f.desc}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, marginTop: "auto", display: "flex", flexDirection: "column", gap: 5, position: "relative" }}>
        {f.bullets.map((b, i) => (
          <li key={i} className="row gap-2" style={{ fontSize: 12, color: "var(--ink-soft)", alignItems: "flex-start" }}>
            <span className="mono" style={{ color: accent, fontWeight: 700, flexShrink: 0, paddingTop: 1 }}>·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   08 — COLOPHON  (team / footer)
============================================================ */
function Colophon() {
  return (
    <footer id="colophon" style={{ background: "var(--ink)", color: "#E8E4D8", padding: "80px 0 56px" }}>
      <div className="shell">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 40 }} className="col-grid reveal reveal-rise">
          <div>
            <div className="mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.2em", color: "rgba(255,255,255,0.5)" }}>
              <span style={{ color: "var(--a-yellow)" }}>◆</span>&nbsp; PORTFOLIO REVIEWER
            </div>
            <h3 className="display" style={{ fontSize: 32, color: "#fff", marginTop: 12, letterSpacing: "-0.03em" }}>
              한 책상,<br /><em>하나의 검토</em>.
            </h3>
            <p className="serif" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.7)", maxWidth: 280 }}>
              알고리즘 팀 캡스톤. Solar LLM과 여덟 알고리즘이 종이처럼 펼쳐진 인터페이스 위에서 함께 일한다.
            </p>
          </div>
          <div>
            <div className="smcaps" style={{ color: "rgba(255,255,255,0.5)" }}>Sections</div>
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              <li><a href="#abstract">§ 00 Abstract</a></li>
              <li><a href="#interface">§ 01 Interface</a></li>
              <li><a href="#method">§ 02 Method</a></li>
              <li><a href="#demo">§ 03 Live Demo</a></li>
              <li><a href="#catalog">§ 04 Algorithms</a></li>
              <li><a href="#features">§ 05 Features</a></li>
            </ul>
          </div>
          <div>
            <div className="smcaps" style={{ color: "rgba(255,255,255,0.5)" }}>Team</div>
            <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              <li className="serif">김OO &nbsp;<span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Front · LLM</span></li>
              <li className="serif">이OO &nbsp;<span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Hash · BST</span></li>
              <li className="serif">박OO &nbsp;<span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>LCS · ED</span></li>
              <li className="serif">최OO &nbsp;<span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Rabin-Karp</span></li>
            </ul>
          </div>
          <div>
            <div className="smcaps" style={{ color: "rgba(255,255,255,0.5)" }}>Colophon</div>
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.75, color: "rgba(255,255,255,0.7)" }}>
              <div className="serif">Set in <em>Source Serif 4</em></div>
              <div>UI: Inter · Code: JetBrains Mono</div>
              <div style={{ marginTop: 8 }}>Printed digitally,<br />Seoul, 2025</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 56, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.12)" }} className="row between wrap gap-3">
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "rgba(255,255,255,0.5)" }}>
            © 2025 ALGORITHM TEAM · CAPSTONE v0.4
          </span>
          <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "rgba(255,255,255,0.5)" }}>
            Set in Source Serif 4 · Inter · JetBrains Mono
          </span>
        </div>
      </div>
      <style>{`
        @media (max-width: 880px) { .col-grid { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 540px) { .col-grid { grid-template-columns: 1fr !important; } }
        footer a:hover { color: var(--a-yellow); }
      `}</style>
    </footer>);

}

/* ============================================================
   REVIEW CONSOLE  (fixed scanner — crosshair tracks cursor,
   live readout cycles through ROSTER)
============================================================ */
function ReviewConsole() {
  const consoleRef = useRef(null);
  const crossH = useRef(null);
  const crossV = useRef(null);
  const [active, setActive] = useState(0);

  // cycle through candidates
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % ROSTER.length), 2400);
    return () => clearInterval(id);
  }, []);

  // crosshair tracks cursor (clamped to ~14px max offset)
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    let raf;
    let target = { x: 0, y: 0 };
    let cur = { x: 0, y: 0 };
    const onMove = (e) => {
      const el = consoleRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const maxOff = 16;
      const k = dist > 0 ? Math.min(maxOff, dist * 0.04) / dist : 0;
      target = { x: dx * k, y: dy * k };
    };
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.18;
      cur.y += (target.y - cur.y) * 0.18;
      if (crossH.current) crossH.current.style.transform = `translateY(${cur.y}px)`;
      if (crossV.current) crossV.current.style.transform = `translateX(${cur.x}px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove);
    return () => { window.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); };
  }, []);

  const c = ROSTER[active];
  const score = useCountUp(c.score, 600);
  const accent = c.color === "orange" ? "var(--a-orange)"
              : c.color === "green"  ? "var(--a-green)"
              : c.color === "red"    ? "var(--a-red)"
              : "var(--a-blue)";

  return (
    <div className="review-console" ref={consoleRef} style={{
      width: 208,
      background: "var(--paper)",
      border: "1px solid var(--line)",
      borderLeft: `4px solid ${accent}`,
      boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 16px 30px -12px rgba(60,50,30,.14)",
      display: "flex", flexDirection: "column",
      transition: "border-left-color .35s ease",
    }}>
      {/* status bar */}
      <div className="row between" style={{ padding: "8px 12px", borderBottom: "1px solid var(--line-faint)" }}>
        <span className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: "var(--muted)" }}>
          <span style={{ color: accent }}>◆</span>&nbsp; SCANNER
        </span>
        <span className="row gap-1" style={{ alignItems: "center" }}>
          <span className="live-dot" style={{ width: 5, height: 5 }} />
          <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: "var(--a-red)", letterSpacing: "0.16em" }}>LIVE</span>
        </span>
      </div>

      {/* lens with crosshair tracking cursor */}
      <div style={{ position: "relative", height: 104, background: "var(--white)", overflow: "hidden", borderBottom: "1px solid var(--line-faint)" }}>
        {/* concentric reticles */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 80, height: 80, borderRadius: "50%", border: "1px dashed var(--line-strong)" }}/>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--line-strong)" }}/>
        {/* tick marks at cardinal directions */}
        {[
          { x: 4, y: "50%", w: 6, h: 1 },
          { x: "calc(100% - 10px)", y: "50%", w: 6, h: 1 },
          { x: "50%", y: 4, w: 1, h: 6 },
          { x: "50%", y: "calc(100% - 10px)", w: 1, h: 6 },
        ].map((t, i) => (
          <span key={i} style={{ position: "absolute", left: t.x, top: t.y, width: t.w, height: t.h, background: "var(--line-strong)", transform: typeof t.x === "string" && t.x.includes("%") ? "translateX(-50%)" : "none" }}/>
        ))}

        {/* crosshair lines — track cursor */}
        <div ref={crossV} style={{
          position: "absolute", left: "calc(50% - 0.5px)", top: 6, bottom: 6, width: 1,
          background: accent, opacity: 0.5, willChange: "transform",
        }}/>
        <div ref={crossH} style={{
          position: "absolute", top: "calc(50% - 0.5px)", left: 6, right: 6, height: 1,
          background: accent, opacity: 0.5, willChange: "transform",
        }}/>

        {/* score readout */}
        <div className="mono" style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
          fontSize: 32, fontWeight: 600, color: accent, letterSpacing: "-0.04em",
          background: "var(--white)", padding: "0 8px",
          lineHeight: 1,
        }}>
          {score}<span style={{ fontSize: 13, opacity: 0.5 }}>%</span>
        </div>
      </div>

      {/* candidate readout */}
      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.2em", color: "var(--muted)" }}>
            ▸ NOW REVIEWING
          </span>
          <span className="mono" style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.14em", color: accent }}>
            {String(active + 1).padStart(2, "0")} / {String(ROSTER.length).padStart(2, "0")}
          </span>
        </div>
        <div className="row between" style={{ alignItems: "baseline" }}>
          <span className="serif" style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em" }}>
            {c.name}
          </span>
          <span className="mono" style={{ fontSize: 9, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            CAND. {c.n}
          </span>
        </div>
      </div>

      <style>{`@media (pointer: coarse) { .review-console { display: none !important; } }`}</style>
    </div>
  );
}

/* ============================================================
   FINAL CTA — explicit workspace entry
============================================================ */
function FinalCTA() {
  const onEnter = React.useContext(ON_ENTER_CTX);
  const ref = useReveal();
  return (
    <section style={{ background: "var(--paper)", padding: "120px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
      <div className="shell" ref={ref} style={{ textAlign: "center" }}>
        <div className="smcaps reveal" style={{ color: "var(--a-blue)", marginBottom: 18 }}>▸ Ready</div>
        <h2 className="display reveal" style={{ fontSize: "clamp(40px, 6vw, 72px)", lineHeight: 0.98, marginBottom: 22 }}>
          이제, <em style={{ fontStyle: "italic", color: "var(--a-blue)" }}>책상 위로</em>.
        </h2>
        <p className="serif reveal" style={{ "--rd": "120ms", fontSize: 17, fontStyle: "italic", color: "var(--ink-soft)", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.55 }}>
          포트폴리오를 업로드하고, 필요 스펙을 입력하고, 정렬된 결과를 한 화면에서 확인하세요.
        </p>
        <div className="row center gap-3 wrap reveal" style={{ "--rd": "200ms" }}>
          <button type="button" onClick={onEnter} className="btn solid" style={{ padding: "14px 26px", fontSize: 12 }}>
            Open Workspace <span className="arr">→</span>
          </button>
          <a href="#abstract" className="btn ghost" style={{ padding: "14px 26px", fontSize: 12 }}>
            맨 위로 ↑
          </a>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   HomePage — exported default
============================================================ */
function HomePageInner() {
  useScrollReveals();
  return (
    <>
      <Masthead />
      <Hero />
      <Abstract />
      <Interface />
      <Method />
      <Demo />
      <Catalog />
      <Features />
      <FinalCTA />
      <Colophon />
    </>);

}

export default function HomePage({ onEnter }) {
  // body 배경 동기화 + 스크롤 락 해제 — HomePage 마운트 동안만 적용
  // (WorkflowPage 용 index.css 가 body/html/#root 에 height:100%, overflow:hidden 을 걸어둠)
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const root = document.getElementById('root');

    const snapshot = {
      bodyBg: body.style.background,
      bodyColor: body.style.color,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      rootHeight: root?.style.height ?? '',
      rootOverflow: root?.style.overflow ?? '',
    };

    body.style.background = '#fafaf7';
    body.style.color = '#1a1612';
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    html.style.overflow = 'auto';
    html.style.height = 'auto';
    if (root) {
      root.style.height = 'auto';
      root.style.overflow = 'visible';
    }

    return () => {
      body.style.background = snapshot.bodyBg;
      body.style.color = snapshot.bodyColor;
      body.style.overflow = snapshot.bodyOverflow;
      body.style.height = snapshot.bodyHeight;
      html.style.overflow = snapshot.htmlOverflow;
      html.style.height = snapshot.htmlHeight;
      if (root) {
        root.style.height = snapshot.rootHeight;
        root.style.overflow = snapshot.rootOverflow;
      }
    };
  }, []);

  const handleEnter = typeof onEnter === 'function' ? onEnter : () => {};
  return (
    <ON_ENTER_CTX.Provider value={handleEnter}>
      <div className="home-page">
        <HomePageInner />
      </div>
    </ON_ENTER_CTX.Provider>
  );
}