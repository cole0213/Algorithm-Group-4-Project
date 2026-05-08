# **Solar LLM 사용 매뉴얼**
*(Upstage Solar API 연동 가이드)*

## 1. Solar 핵심 기능
- **구조화된 출력**: JSON/XML 형식으로 정확한 데이터 추출 가능
- **다국어 지원**: 한국어·영어 네이티브 수준의 이해력
- **문서 분석 특화**: PDF/이미지 텍스트 추출 후 분석에 최적화
- **저비용 고효율**: 복잡한 로직도 프롬프트 엔지니어링으로 구현 가능

---

## 2. Solar API 연동 절차
### (1) **OCR로 PDF 텍스트 추출**
```python
# Upstage OCR API 예시
import requests
response = requests.post(
  "https://api.upstage.ai/v1/ocr",
  headers={"Authorization": "Bearer [OCR_API_KEY]"},
  json={"image_url": "PDF_URL", "options": {"language": "ko"}}
)
raw_text = " ".join([text["text"] for text in response.json()["texts"]])
```

### (2) **Solar로 데이터 파싱**
```python
# Solar API 예시
solar_prompt = f"""
PDF 텍스트에서 다음 정보를 JSON으로 추출:
- 이름, 기술 스택(리스트), 경력(년), 프로젝트(기간/역할), 학력, 링크
텍스트: {raw_text}
"""
response = requests.post(
  "https://api.upstage.ai/v1/solar",
  headers={"Authorization": "Bearer [SOLAR_API_KEY]"},
  json={
    "model": "solar-pro-2",
    "messages": [
      {"role": "system", "content": solar_prompt},
      {"role": "user", "content": raw_text}
    ]
  }
)
structured_data = response.json()["choices"][0]["message"]["content"]
```

---

## 3. 프롬프트 설계 팁
### ✅ **포트폴리오 파싱 예시**
```json
{
  "이름": "홍길동",
  "기술스택": ["React", "Python", "AWS"],
  "경력": "3년",
  "프로젝트": [
    {"이름": "쇼핑몰 플랫폼", "기간": "6개월", "역할": "프론트엔드 개발"}
  ]
}
```

### ✅ **프롬프트 템플릿**
> "다음 PDF 텍스트에서 [항목] 형식으로 데이터를 추출하세요.
> 기술 스택은 대소문자/약어를 정규화하고, 프로젝트는 기간·역할을 포함해 주세요."

---

## 4. Solar 최적화 전략
1. **명확한 지시어 사용**: *"JSON 형식으로 추출"*, *"정규화된 기술 스택"*
2. **컨텍스트 제한**: 한 번에 1~2페이지 분량의 텍스트만 전달
3. **후처리 로직 추가**: 추출된 JSON은 반드시 유효성 검사 수행

---

## 5. 주의사항
- **API 키 관리**: 환경 변수 또는 Secret Manager 사용 권장
- **토큰 계산**: Solar Pro 2는 4,096 토큰 제한 → 긴 텍스트는 분할 처리
- **에러 핸들링**: API 호출 실패 시 재시도 로직 구현 필수