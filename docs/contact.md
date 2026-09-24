# NCG 문의 접수

- 공개 화면: https://newlightchurchglobal.com/#/contact
- 접수함: https://app.netlify.com/projects/ncg-newlight/forms (Netlify 운영자 로그인 필요)
- 분류: 건의사항, 불편사항, 감사 인사, 기타 문의
- 로그인 없이 접수하며 이름과 답장 이메일은 선택입니다. 문의는 공개 게시판에 표시되지 않습니다.
- 정적 HTML `public/contact-form.html`이 Netlify Forms에 `ncg-contact` 양식을 등록합니다. React 화면은 같은 필드 이름으로 HTTPS POST를 전송합니다.
- Netlify의 스팸 처리와 숨김 website 필드를 사용합니다. 입력 검증, 중복 전송 방지, 오류 시 작성 내용 보존을 적용했습니다.
- 관리자 화면의 문의 접수함 탭에서 운영자용 Netlify 화면을 엽니다. 앱 번들에 관리용 토큰을 넣지 않습니다.
- 2026-09-24 01:45 KST: 양식 감지 활성화, 배포 6ab4020c9a4a57b1d8c5664a, `1 form collecting data` / `ncg-contact` 등록 확인.
- PC 및 390px 모바일 화면 확인, 빌드와 128개 테스트 통과. 실제 문의 제출이나 메일 발송은 하지 않았습니다.
- 이메일 알림은 설정하지 않았습니다. 문의는 운영자 접수함에서 확인하고 답장을 수동으로 보냅니다.

공식 문서: https://docs.netlify.com/manage/forms/setup/ · https://docs.netlify.com/manage/forms/spam-filters/ · https://docs.netlify.com/manage/forms/submissions/

## 2026-09-24 14:07 KST 운영 검증

- 사용자가 공식 주소를 `infonewlightch@gmail.com`으로 확정했습니다. 기존 `infonewlighch@gmail.com`은 오기입니다.
- `ncg-contact`에 새 접수 이메일 알림을 연결했습니다. 수신자는 위 공식 주소, 제목은 `[NCG] 새 문의가 접수되었습니다`입니다.
- 실제 HTTPS 사이트에서 한국어 기타 문의 1건(이름 `NCG 운영 점검`, 답장 주소 비움)을 제출했습니다. 사이트 성공 화면, Netlify **Verified submissions**의 동일 본문·분류·언어, 공식 Gmail 받은편지함의 알림 메일을 모두 확인했습니다. 검증 표식: `NCG-QA-20260924-1419`(식별자이며 시각 아님). 실제 접수 시각 14:02 KST.
- 최초 조회에 빈 목록이 잠시 나타났고, 수신함이 갱신된 후 같은 1건을 확인했습니다. 중복 전송하지 않았습니다. 시험 기록은 접수함에 유지합니다.
- 기본 스팸·honeypot 설정은 유지했습니다. 모든 메시지가 스팸 오탐 없이 전달된다는 의미는 아닙니다.
