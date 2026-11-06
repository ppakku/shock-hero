# dev-standards 검사

PR에서 새로 더한 줄만 보고 네 가지를 막는다. 이미 있는 코드는 막지 않는다.

| 규칙 | 막는 것 | 근거 |
|---|---|---|
| pii-log | 로그에 이메일, 전화, 토큰 같은 값을 찍는 코드 | 채점 51개 중 원칙 6 1점 16곳의 주원인 |
| naive-time | `date.today()`, `datetime.now()`, `toISOString().slice(0,10)` 같은 시간대 없는 날짜 | 서버가 UTC라 한국 0~9시에 날짜가 하루 어긋남(계약 시스템, 시스템 관리 등) |
| swallowed-error | 빈 `catch {}`, 모든 예외를 받아 `pass` | 사고 1순위인 조용한 실패 |
| file-size | 1,000줄 넘는 파일을 새로 만들거나 더 키움(테스트, 생성 파일 제외) | 개발자 리뷰에서 반복된 "책임이 섞인 큰 파일" |

정말 필요한 줄은 그 줄이나 바로 윗줄에 `dev-standards: allow <규칙> <이유>`를 단다. 파일 크기는 파일 첫 5줄에 단다.

## 레포에 붙이는 법
1. `dev_standards_check.py`를 레포의 `tools/dev-standards/`에 그대로 복사한다.
2. `dev-standards.yml`을 `.github/workflows/`에 복사한다.
3. 머지 뒤 main 브랜치 필수 검사에 `dev-standards`와 그 레포의 타입체크, 린트, 테스트 job을 건다.

원본은 여기 하나다. 레포 사본을 직접 고치지 말고 여기서 고친 뒤 VERSION을 올려 다시 복사한다.

시험(2026-11-06, 8개 레포 최근 30커밋): 남은 지적 대부분이 진짜이거나 이유를 적어 통과시킬 경우였다.
