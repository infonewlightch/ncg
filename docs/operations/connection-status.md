# NCG 운영 연결 기록 — 2026-09-24

## 공식 계정 확정

사용자 확인으로 공식 이메일·관리자 대상은 **infonewlightch@gmail.com**(light의 t 포함)입니다. Supabase/Netlify/교회 Google에 로그인된 계정과 같습니다. 사이트와 발송용 mailto, 관리자 등록 안내에서 이전 오기를 수정했습니다. 이메일 일치만으로 관리자 권한을 자동 부여하지 않습니다.

## 완료한 실제 운영 작업

- 문의: 실제 사이트 제출 → Netlify 비공개 접수함 저장 → 공식 Gmail 알림 수신 확인. [문의 기록](../contact.md).
- Google Cloud: 교회 계정 재로그인 및 사용자의 2단계 인증 완료 후 `ncg-new-light-church-global` 프로젝트 생성. 결제 계정·무료 체험·유료 리소스 연결 없음.
- OAuth 앱 초기 정보 입력: 이름 `NCG - New Light Church Global`, 지원·개발 연락처 공식 이메일, 외부 대상/테스트 모드. Google API 사용자 데이터 정책 동의 전 단계에서 사용자 확인 대기.
- Supabase 이메일: custom SMTP 꺼짐을 직접 확인. 기본 발송은 조직 운영자 검증에만 사용할 수 있으며 일반 회원용 SMTP 연결을 대체하지 않습니다.
- 교회 운영자 이메일: 실제 공개 NCG 가입 → Gmail 인증 메일 수신 → 링크 인증 → 마이페이지 로그인 성공. Supabase에서 2026-09-24 14:12 KST 인증·로그인 기록을 확인했습니다. 일반 회원 SMTP 완료라는 의미는 아닙니다.
- 관리자 등록은 정확한 UID·확인된 이메일·미삭제 상태를 모두 대조하는 `supabase/register-verified-owner.sql`로 준비했습니다. 권한 부여 실행 전 사용자 확인 대기 중입니다.

## 콘텐츠 준비

- 대한성서공회 [개역개정 이용허가 문의 초안](nkrv-permission-request.md) 작성. 발송·허가·비용 약정 없음.
- 새빛교회 공식 YouTube oEmbed에서 아래 3개 영상의 제목과 채널 소유를 확인했습니다. 등록·발행 전이며 업로드 날짜/설교자를 추정하지 않습니다.
  - https://www.youtube.com/watch?v=xCNKLQIMGJI
  - https://www.youtube.com/watch?v=bPnyINarN04
  - https://www.youtube.com/watch?v=4YFNv1Szab8

## 미완료

OAuth 클라이언트/시크릿과 Supabase provider 연결, 일반 이용자 SMTP, 관리자 역할, 실제 두 회원 통합 검증, 승인 QT 발행, 푸시 운영 비밀값 및 실기기 수신, 개역개정 이용허가·본문 공급, 교육/QT 번역·교회 검수, 실제 보조기기 접근성 점검.
