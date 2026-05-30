export default function HomePage({ onEnter }) {
  return (
    <div className="home-page">
      <nav className="home-nav">
        <span className="home-nav-logo">Portfolio Reviewer</span>
        <button className="home-nav-cta" onClick={onEnter}>워크플로우 시작 →</button>
      </nav>
      <section className="home-hero">
        <h1 className="home-hero-title">개발자 포트폴리오<br />AI 기반 서류 심사</h1>
        <p className="home-hero-sub">Solar LLM 기반 포트폴리오 파싱 · 필요 스펙 하이라이트 · 유사 문장 검출</p>
        <button className="home-hero-btn" onClick={onEnter}>지금 시작하기</button>
      </section>
      <section className="home-features">
        <div className="home-feature-card">
          <div className="home-feature-icon" />
          <h3>AI 포트폴리오 파싱</h3>
          <p>PDF · MD · TXT 형식을 Solar LLM으로 자동 정형화</p>
        </div>
        <div className="home-feature-card">
          <div className="home-feature-icon" />
          <h3>스펙 매칭 분석</h3>
          <p>필요 스펙 입력 시 매칭률 자동 계산 및 하이라이트</p>
        </div>
        <div className="home-feature-card">
          <div className="home-feature-icon" />
          <h3>유사 문장 검출</h3>
          <p>포트폴리오 간 유사 문장 Rabin-Karp 알고리즘으로 검출</p>
        </div>
        <div className="home-feature-card">
          <div className="home-feature-icon" />
          <h3>블라인드 심사</h3>
          <p>이름 블러 처리로 무의식적 편향 없는 공정한 심사</p>
        </div>
      </section>
      <footer className="home-footer">
        <p>Portfolio Reviewer · Algorithm Group 4</p>
      </footer>
    </div>
  );
}
