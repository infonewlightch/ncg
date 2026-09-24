# 진행 중: 두란노 일정 + 본문 중심 QT (2026-09-24)

## 사용자 확정
- 두란노 생명의삶 월간 날짜·성경 범위를 따름. 사용자 계정 로그인 완료(14:47경), 앞으로 자동 확인/반영 요청.
- 제목/묵상 안내/적용 질문을 매일 만들지 않도록 관리자 필수 입력과 공개 흐름에서 제거. 본문 바로 아래 나눔·하트·댓글 요청.
- 개신교 정경 66권과 검토된 역본만. 성경 정책 commit 1a6d44b GitHub 반영. Netlify 배포 확인 아직 필요.
- 자동화 ncg-qt ACTIVE, 매일 한국시간 05:00. 기존 밤샘 개발 ncg는 PAUSED 유지.

## 확인 자료
- 로그인된 두란노 달력은 2026-09/10 선택 가능. 9월 30일, 10월 31일 범위 확인. CUA JS septemberQtCells/octoberQtCells에 보이는 cell 문자열 보관.
- 10/7 달력의 없음 0:0~0은 오류. 공식 PDF https://www.duranno.com/qt/plus/202610_daily_schedule.pdf 에서 1CH.20.1-8 확인. 사용자의 제안도 일치.
- 공식 PDF 임시 경로 tmp/pdfs/duranno-202610.pdf 및 렌더 PNG. pypdf 텍스트와 pypdfium2 이미지 검토 완료. 본문·해설은 복제하지 않고 일정 메타데이터만 사용.
- 10/10은 역대상 21:18~22:1로 장을 넘음. 9/13~16도 여러 장 범위. 누락하거나 한 장만 표시하면 안 됨.

## 현재 미완료 코드
- src/data/qt/duranno-schedule.json 에 현재 9/24 하나만 등록. 전체 확인된 달력으로 확장 필요.
- src/core/qt-schedule.ts 및 tests: 참조만 먼저 읽고 미검수 미리보기/다른 장절의 나눔이 섞이지 않도록 초안 구현.
- QuietTime.tsx: 미발행이어도 검증된 날짜 본문 표시 초안. 기존 해설 구조는 아직 남음.
- i18n/source.json: 기존 preview 전용 문구 제거로 767키. 주요 언어 seed 테스트 9개 통과.
- QtScripture: 외부 개역개정에서 가짜 네트워크 오류 대신 공식 링크/WEB 선택. bibleRequest에서 eBible/getBible QT 절 범위 필터 수정. 이 부분은 1a6d44b에 포함.

## 이어서 해야 할 일
1. migration 012: 빈 translations 허용, 날짜/장절만 발행, 여러 장 passage list 지원 및 발행된 범위 잠금/정경검증. 아직 파일 작성 안 함. Supabase 001~011 재실행 금지.
2. AdminQt 날짜·장절 중심, 확인된 일정을 가져와 저장/발행. QuietTime 본문->나눔, 과거 해설은 삭제하지 않고 표시 제거. qtCopy/pushPayload의 빈 translations 안전성 유지.
3. 댓글은 기존 ncg_posts의 부모 글 관계로 구현하면 기존 번역/신고/차단/검수 활용 가능. 부모는 최상위 공개글만, pending/blocked 격리, rate limit. 아직 구현 안 함.
4. meaningful SQL/RLS + React tests, PC/mobile 실제 브라우저 검증. 증분 migration만 실제 적용, 검증된 일정 발행, GitHub/Netlify 배포 확인.
