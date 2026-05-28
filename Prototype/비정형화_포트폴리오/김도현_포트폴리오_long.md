# 김도현 (Kim Dohyun)
### Fullstack Engineer · 8년 경력

📧 dohyun.kim.dev@gmail.com
🔗 github.com/dohyun-fullstack
💼 linkedin.com/in/dohyun-kim-dev
📍 서울특별시 마포구

---

## 소개

안녕하세요. 저는 8년 차 풀스택 엔지니어 김도현입니다.

스타트업부터 대기업 자회사까지 다양한 환경에서 프론트엔드·백엔드·인프라를 넘나들며 일해왔습니다.
특히 "빠르게 만들고, 빠르게 검증하고, 느리게 망가지는 시스템"을 만드는 것에 관심이 많습니다.

코드를 짜는 것만큼 팀 내 기술 문화를 만드는 것도 좋아합니다.
온보딩 문서를 꼼꼼히 쓰고, 코드 리뷰를 진지하게 하고, 장애 회고를 숨기지 않고 공유합니다.
그게 장기적으로 팀을 더 빠르게 만든다고 믿기 때문입니다.

현재는 B2B SaaS 스타트업에서 플랫폼 팀 리드를 맡고 있으며,
제품의 기반이 되는 공통 인프라와 내부 도구를 만들고 있습니다.

---

## 경력 사항

### 크래프트랩 (CraftLab Inc.) — Platform Lead Engineer
`2022.07 ~ 현재 | 서울 성수`

B2B HR·인사관리 SaaS 스타트업 (Series B, 직원 80명).
플랫폼 팀 3인 중 리드, 백엔드 파트 전반 설계·운영 담당.

**주요 업무**

- 멀티 테넌트 아키텍처 설계 및 구현 (테넌트 격리 전략: schema-per-tenant)
- API Gateway 도입 (Kong) 및 인증·권한 미들웨어 표준화
- 사내 공통 라이브러리 패키지 운영 (Python 내부 패키지 레지스트리)
- GitHub Actions 기반 CI/CD 파이프라인 전면 재구축
- 신규 입사자 온보딩 프로그램 설계 및 운영 (입사 첫 주 체크리스트, 페어 프로그래밍 세션)
- 분기별 아키텍처 리뷰 세션 운영

**성과**

- 테넌트 격리 구조 도입으로 고객사 간 데이터 유출 위험 완전 제거
- CI 빌드 시간 평균 18분 → 6분으로 단축 (캐시 전략 최적화)
- 내부 라이브러리 표준화로 신규 서비스 셋업 시간 3일 → 4시간으로 단축
- 온콜 MTTR 평균 52분 → 14분으로 개선 (런북 체계화 기여)

**기술 스택**

Python 3.11, FastAPI, PostgreSQL 15, Redis, Kafka, Kong API Gateway,
Kubernetes (EKS), Terraform, GitHub Actions, Datadog

---

### 버티컬커머스 — Senior Backend Engineer
`2020.03 ~ 2022.06 | 서울 강남`

패션 버티컬 이커머스 (MAU 130만). 주문·결제·정산 도메인 담당.

**주요 업무**

- 주문 처리 서비스 MSA 분리 (Django 모놀리스 → FastAPI 마이크로서비스)
- PG사 결제 연동 모듈 설계 (토스페이먼츠, KG이니시스, 카카오페이)
- 셀러 정산 배치 시스템 구현 (월 정산 → 주 정산으로 전환)
- 재고 동시성 문제 해결 (Redis 분산 락 + 낙관적 락 혼합 전략)
- MySQL 슬로우 쿼리 분석 및 인덱스 최적화 (DBA 없는 팀)

**성과**

- 주문 서비스 분리 후 배포 독립성 확보, 배포 주기 월 2회 → 주 3회
- 결제 실패율 1.8% → 0.4%로 감소 (재시도 로직 및 타임아웃 전략 개선)
- 정산 배치 처리 시간 6시간 → 40분으로 단축 (청크 처리 + 병렬화)
- 슬로우 쿼리 TOP 10 전수 개선, DB 평균 응답 시간 30% 감소

**기술 스택**

Python, FastAPI, Django, MySQL, Redis, Celery, AWS (EC2, RDS, SQS, S3), Docker

---

### 솔루션트리 — Full-stack Developer
`2017.08 ~ 2020.02 | 서울 종로`

중견 SI 기업. 금융·공공 도메인 웹 시스템 구축 프로젝트 다수.

- 증권사 고객 자산관리 포털 프론트엔드 개발 (React, Redux)
- 지자체 민원 처리 시스템 백엔드 개발 (Java Spring, Oracle)
- 사내 공통 UI 컴포넌트 라이브러리 초기 구축 참여
- 코드 리뷰 문화 없던 팀에서 PR 템플릿 도입 제안 및 정착

**기술 스택**

Java 8, Spring MVC, Oracle, React, Redux, jQuery, SVN → Git 전환 주도

---

## 기술 스택

**언어**
- Python (주력, 5년+)
- TypeScript / JavaScript (프론트·백엔드 공용, 4년+)
- Java (SI 시절, 3년, 현재 유지보수 수준)
- SQL (고급, MySQL / PostgreSQL / Oracle 실무 경험)
- Bash (자동화 스크립트 수준)

**프레임워크 / 라이브러리**
- FastAPI, Django REST Framework
- React, Next.js (SSR 프로젝트 경험)
- Celery (비동기 태스크)
- SQLAlchemy, Alembic (마이그레이션)
- pytest, factory_boy (테스트)

**데이터베이스**
- PostgreSQL (주력, 파티셔닝·JSONB·PL/pgSQL 활용)
- MySQL (이커머스 재직 시 주력)
- Redis (캐시, 분산 락, Pub/Sub, Rate Limiting)
- MongoDB (사이드 프로젝트 수준)
- Elasticsearch (검색 기능 연동 경험)

**인프라 / 클라우드**
- AWS: EKS, EC2, RDS, S3, SQS, Lambda, CloudFront, Route53
- Kubernetes (운영 수준, Helm Chart 작성 경험)
- Terraform (모듈화된 IaC 작성 경험)
- Docker / Docker Compose
- Kong API Gateway (플러그인 커스터마이징 포함)
- Datadog (APM, 로그, 대시보드, 알럿 설정)

**CI/CD**
- GitHub Actions (현재 주력, 재사용 가능한 워크플로우 설계)
- Jenkins (이전 회사)
- ArgoCD (GitOps 배포)

---

## 아키텍처 철학

지금까지 일하면서 제가 중요하게 생각하게 된 원칙들을 정리해봤습니다.

**1. 복잡성은 천천히 도입한다**

처음부터 마이크로서비스를 도입하는 것보다, 잘 구조화된 모놀리스에서 시작해 병목이 생기는 부분부터 분리하는 접근을 선호합니다. 솔루션트리에서 처음 MSA라는 단어를 들었을 때는 막연히 좋은 것이라 생각했지만, 버티컬커머스에서 직접 분리 작업을 해보니 분산 트랜잭션·네트워크 지연·배포 복잡성 비용이 생각보다 훨씬 크다는 걸 체감했습니다. 지금은 "나눠야 할 이유"가 명확해졌을 때 나눕니다.

**2. 관측 가능성은 기능이다**

로그·메트릭·트레이싱이 없는 시스템은 블랙박스입니다. 크래프트랩에서 Datadog APM을 도입하면서 "몰랐던 병목"을 수십 개 발견했습니다. 새 서비스를 만들 때 관측 가능성 계층을 처음부터 설계에 넣는 것이 나중에 붙이는 것보다 훨씬 저렴합니다.

**3. 테스트는 설계 피드백이다**

테스트를 쓰기 어렵다면 설계가 나쁜 것입니다. 결제 모듈을 리팩터링할 때 테스트가 불가능한 코드 구조가 얼마나 유지보수를 어렵게 만드는지 직접 경험했습니다. 지금은 테스트가 어렵게 느껴지면 코드 구조를 먼저 의심합니다.

---

## 팀 문화 기여

기술 역량 외에 팀에 기여했다고 생각하는 활동들입니다.

**런북(Runbook) 체계화**

버티컬커머스 재직 시 온콜 당번이 장애 상황에서 "어떻게 해야 하나" 당황하는 경우가 잦았습니다. 자주 발생하는 장애 유형 15개에 대해 증상 → 원인 후보 → 확인 명령어 → 조치 방법으로 이어지는 런북을 Confluence에 작성했습니다. 이후 팀에 새로 합류한 엔지니어도 온콜 2주 차부터 독립적으로 대응할 수 있었습니다.

**ADR(Architecture Decision Record) 문화 도입**

크래프트랩에서 "왜 이렇게 만들었지?"라는 질문이 반복되는 것을 보고 ADR을 도입했습니다. 주요 기술 결정(DB 선택, 인증 방식, API 설계 원칙 등)을 템플릿에 맞춰 기록하고 PR로 리뷰합니다. 현재 32개 ADR이 쌓여 있으며, 신규 입사자 온보딩 자료로도 활용됩니다.

**위클리 테크 세션**

격주 금요일 30분, 팀원이 돌아가며 최근 배운 것·삽질한 것을 공유하는 세션을 운영 중입니다. 발표 부담을 낮추기 위해 슬라이드 없이 터미널·코드만 보여줘도 된다는 규칙을 만들었습니다. 1년 넘게 운영 중이며, 팀원들의 만족도 피드백이 좋습니다.

---

## 주요 프로젝트

### [프로젝트 1] 멀티 테넌트 플랫폼 재설계 (크래프트랩)

**배경**

입사 당시 크래프트랩의 백엔드는 단일 DB에 `company_id` 컬럼으로 테넌트를 구분하는
"공유 스키마(shared schema)" 방식이었습니다.

고객사가 20개를 넘어가면서 문제가 생기기 시작했습니다.
- 실수로 `company_id` 필터를 빠뜨린 쿼리가 다른 테넌트 데이터를 노출할 위험
- 특정 고객사의 대용량 쿼리가 전체 DB 성능에 영향
- 엔터프라이즈 고객이 "데이터 격리 증빙"을 계약 조건으로 요구하기 시작

**접근 방식**

schema-per-tenant 방식으로 전환하기로 결정했습니다.
각 테넌트는 독립된 PostgreSQL 스키마(네임스페이스)를 갖고,
애플리케이션 레이어에서 `search_path`를 동적으로 설정하는 방식입니다.

SQLAlchemy의 `before_cursor_execute` 이벤트 훅을 활용해
커넥션 풀에서 꺼낸 커넥션마다 자동으로 `SET search_path` 구문을 실행했습니다.

```python
@event.listens_for(engine, "before_cursor_execute")
def set_tenant_schema(conn, cursor, statement, parameters, context, executemany):
    tenant_id = get_current_tenant()  # 요청 컨텍스트에서 추출
    if tenant_id:
        cursor.execute(f"SET search_path TO tenant_{tenant_id}, public")
```

마이그레이션은 Alembic을 커스터마이징해서 새 테넌트 생성 시
공통 마이그레이션 히스토리를 해당 스키마에 자동 적용하도록 했습니다.

**결과**

- 테넌트 간 데이터 격리 보장 → 엔터프라이즈 계약 2건 성사 (ACV 각각 8천만 원)
- 쿼리 필터 누락으로 인한 데이터 노출 위험 구조적으로 제거
- 전환 과정에서 다운타임 0 (온라인 마이그레이션 설계)

---

### [프로젝트 2] 결제 연동 모듈 통합 설계 (버티컬커머스)

**배경**

PG사 3곳을 각각 별도 코드로 연동하고 있어서, 신규 PG사 추가 시마다
결제·취소·환불 로직을 처음부터 다시 짜야 했습니다.
코드 중복이 심하고 테스트도 PG사마다 따로 관리했습니다.

**설계**

공통 인터페이스(`PaymentGateway`)를 정의하고 PG사별 어댑터를 구현하는 방식으로 통합했습니다.

```python
class PaymentGateway(Protocol):
    def request_payment(self, order: Order) -> PaymentResult: ...
    def cancel_payment(self, payment_id: str, reason: str) -> CancelResult: ...
    def refund_payment(self, payment_id: str, amount: int) -> RefundResult: ...

class TossPaymentsGateway:
    def request_payment(self, order: Order) -> PaymentResult:
        # 토스페이먼츠 API 호출
        ...

class KakaoPayGateway:
    def request_payment(self, order: Order) -> PaymentResult:
        # 카카오페이 API 호출
        ...
```

공통 재시도 로직, 로깅, 알럿은 데코레이터로 분리했고,
테스트는 `MockGateway`로 PG사 의존성 없이 전부 작성했습니다.

**결과**

- 신규 PG사(KG이니시스) 연동 공수: 기존 5일 → 1.5일
- 결제 관련 유닛 테스트 커버리지 0% → 87%
- 결제 실패율 1.8% → 0.4%로 감소

---

### [프로젝트 3] CI/CD 파이프라인 재구축 (크래프트랩)

**문제**

입사 당시 CI는 젠킨스 서버 한 대가 전사 빌드를 담당하고 있었는데,
- 젠킨스 서버가 죽으면 전사 배포 중단
- 빌드 큐가 밀리면 평균 대기 시간 8분
- Jenkinsfile을 아는 사람이 1명뿐 (버스 팩터 1)

**전환**

GitHub Actions로 전면 전환했습니다.

핵심은 "재사용 가능한 워크플로우(reusable workflows)" 설계였습니다.
모든 서비스가 공통 템플릿을 호출하고, 서비스별 차이(이미지 이름, 배포 환경 등)만
인풋으로 전달하는 구조를 만들었습니다.

```yaml
# .github/workflows/deploy.yml (각 서비스)
jobs:
  deploy:
    uses: craftlab-internal/.github/.github/workflows/deploy-template.yml@main
    with:
      service-name: user-service
      environment: production
      helm-chart-path: ./charts/user-service
    secrets: inherit
```

도커 레이어 캐시는 `actions/cache`와 BuildKit의 `--cache-from` 조합으로 처리했고,
테스트 스텝은 pytest-xdist로 병렬화했습니다.

**결과**

- 평균 빌드 시간 18분 → 6분
- 버스 팩터 1 → 팀 전원이 파이프라인 수정 가능
- 젠킨스 서버 유지보수 비용 제거

---

### [프로젝트 4] 사이드 프로젝트 — DevLog (개인, 오픈소스)

개발 일지를 마크다운으로 작성하면 자동으로 태그·링크·검색 인덱스를 생성해주는 CLI 도구.

처음에는 개인 사용 목적으로 만들었는데, GitHub에 공개 후 생각보다 반응이 좋아서
계속 관리하고 있습니다. (GitHub Stars: 210+)

주요 기능:
- 마크다운 파일에서 태그(`#tag`), 링크(`[[페이지]]`), 날짜를 자동 파싱
- SQLite 기반 로컬 인덱스 생성 및 전문 검색 지원
- `devlog search "키워드"` 명령어로 빠른 검색
- GitHub Actions 연동 → 커밋 시 자동 인덱스 갱신

```python
# devlog/indexer.py 핵심 로직
def build_index(vault_path: Path) -> None:
    db = IndexDatabase(vault_path / ".devlog" / "index.db")
    for md_file in vault_path.rglob("*.md"):
        entry = parse_entry(md_file)
        db.upsert(entry)
    db.rebuild_fts()  # SQLite FTS5 인덱스 재빌드
```

GitHub: github.com/dohyun-fullstack/devlog

---

## 학력 및 자격

**학력**
- 한국외국어대학교 컴퓨터·전자시스템공학부 학사 | 2013.03 ~ 2017.08 | GPA 3.6/4.5

**자격증**
- 정보처리기사 | 2016.11 취득
- AWS Certified Solutions Architect – Associate | 2021.04 취득 | 2024.04 갱신
- AWS Certified Developer – Associate | 2022.01 취득
- Certified Kubernetes Application Developer (CKAD) | 2023.06 취득

**외국어**
- 영어: 기술 문서 독해 및 작성 가능 (TOEIC 880, 2019)

---

## 수상 및 활동

- 2023 AWS Community Day Korea 발표 — "멀티 테넌트 SaaS 아키텍처 실전기"
- 2022 사내 해커톤 우수상 — Slack 연동 인시던트 자동 요약 봇 개발
- 기술 블로그 운영: velog.io/@dohyun-dev (Python, 아키텍처, 회고 관련 35편+)
- 오픈소스 기여: FastAPI 한국어 문서 번역 기여 (PR 3건 머지)
- 판교 백엔드 개발자 모임 정기 참여 (2021~)

---

*최종 수정: 2026-05-24*
