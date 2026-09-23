# NCG · Newlight Church Global

One Gospel. Every Nation. Every Language.

새빛교회가 만드는 예배·성경·전 세계 QT·성경교육·공동체 웹앱. 원본 교회 심볼과 남색/금색을 사용합니다.

## 실행

```sh
cd '/Users/sus4yoo/Desktop/새빛교회/NCG'
npm install
npm run dev
```

로컬 주소: http://127.0.0.1:4310

공식 주소의 개발 미리보기: https://newlightchurchglobal.com/ · 가비아 DNS와 Netlify HTTPS 연결을 확인했습니다. www와 HTTP는 공식 HTTPS 주소로 이동합니다. 기존 https://ncg-newlight.netlify.app/ 도 사용할 수 있습니다.

```sh
npm test
npm run build
npm start
```

## 지금 사용할 수 있는 기능

- 한국어/영어/스페인어 화면과 한 가지 언어 설정. 다른 언어를 선택하면 콘텐츠 선호를 보존하고 영어 UI로 대체함을 표시합니다.
- 7,867개 ISO 639-3 항목 검색, 지역/문자별 언어 태그. 언어 목록은 실제 번역 제공 수가 아닙니다.
- YouTube 링크 또는 HTTPS 동영상 등록·재생·보관. 플레이어는 재생을 누를 때만 연결합니다.
- `#/bible`: 영어 WEBP66권·1,189장 실제 본문. 책/장/절 이동·각주·책갈피·글자크기·읽기배경. 출판사 원문에서 기계적으로 추출한 장별 JSON입니다.
- `#/school`: 새신자4/세례4/입교4/심화16과, 단계별 과정 탐색과 과별 퀴즈. 기존 다바르 ko/en/th 교육 원문.
- `#/school/catechism`: 웨스트민스터 소요리문답107문답, 검색·주제·카드 학습·진도.
- `#/school/quiz`: ko3,011/en3,004/th3,008문제. 난이도·구약/신약/책·문항 수·선택적20초 타이머·힌트·연속정답·오답복습. 점수는 기기에 저장합니다.
- `#/qt`: 주간 본문 일정, 긴 단락의 부분 번호, 해당 날짜 원문/묵상/기도/완료 기록. 현재 요한복음1장 주간안은 교회 검수 전 미리보기입니다.
- 공동체/QT 공유·검토 대기·기도 반응·신고·차단·본인 글 숨김과 관리자 승인을 구현하고 전용 Supabase DB에 연결했습니다. 비회원 체험 글은 브라우저에 저장하며, 가입 계정 통합 검증은 남아 있습니다.
- 친구·채팅·Google/이메일 로그인·프로필과 관리자 화면이 있습니다. Google 제공자·메일·운영 인증 복귀 설정과 실제 계정 검증이 필요합니다.
- 영어 WEBP 전체 66권을 약 9.7 MB와 앱 화면 용량으로 기기에 저장하는 기능을 구현했습니다. 파일 해시를 확인하며 중단 후 이어받습니다. 공개 호스팅에서 실제 오프라인 검증은 진행 중입니다.

화면 문구 668개와 번역 누락·변수 보존을 빌드 때 검사합니다. [언어별 제공 범위와 번역 절차](docs/i18n.md)를 참고하세요.

## 서버 연결

`.env.example`을 참고해 `.env.local`에 설정합니다. 실제 키는 Git 또는 대화창에 넣지 않습니다.

```dotenv
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PUBLIC_PUBLISHABLE_KEY
NCG_YOUVERSION_APP_KEY=SERVER_ONLY_APP_KEY
NCG_TRANSLATION_URL=https://YOUR_PROVIDER/chat/completions
NCG_TRANSLATION_KEY=SERVER_ONLY_KEY
NCG_TRANSLATION_MODEL=YOUR_MODEL
```

- `VITE_`에는 Supabase **공개 publishable/anon 키**만 사용합니다. secret/service_role 키는 금지합니다.
- NCG 전용 Supabase `yndtcpsajhmnyeqeozju`에 공개 클라이언트를 연결했습니다. 승인받은 001–007 설정을 적용했고, 18개 테이블 모두 RLS를 켰습니다. 관리자 0명, 공개 콘텐츠 0건으로 시작합니다.
- 새 프로젝트에서 `supabase/migrations`의 001(회원), 002(QT 발행), 003(알림), 004(공동체), 005(진도 동기화), 006(예배·설교 게시), 007(QT 장절 범위)를 순서대로 적용합니다. 기존 다른 앱 DB에 적용하지 않습니다.
- Supabase Auth에서 Google 제공자를 설정하고 이메일 인증을 활성화합니다. 로컬 허용 redirect URL은 `http://127.0.0.1:4310/auth/callback`, 관리자용 `http://127.0.0.1:4310/admin.html`입니다. 운영 주소가 정해지면 정확한 HTTPS 주소를 추가합니다.
- Google OAuth의 제공자 callback은 Supabase 대시보드가 제시하는 URL을 그대로 사용합니다. 앱 URL을 Google callback으로 추측해서 넣지 않습니다.
- 일반 이메일 인증은 magic link 방식입니다. OTP 직접입력도 제공하며, 이를 쓰려면 인증 메일 템플릿에 토큰 표시를 설정해야 합니다.
- 공개 운영 전에 신규가입, 이메일링크/OTP, Google복귀, 로그아웃, 다른 사용자 저장정보 분리, 계정 진도 동기화를 실제 테스트해야 합니다.

학습/QT 완료와 취소는 변경분으로 동기화하고, 같은 요청의 재전송은 중복 적용하지 않습니다. 연결이 끊기면 기기에 보관 후 다시 시도합니다. 성경 책갈피·퀴즈 점수·개인 등록 영상은 현재 기기 저장입니다.

## 관리자

일반 메뉴에는 관리자 링크가 없습니다. 별도 진입점은 `/admin.html`입니다. 클라이언트 이메일 비교로 권한을 부여하지 않으며 DB `ncg_admins`와 서버 RPC가 확인합니다.

관리자 본인이 **검증된 계정으로 가입한 후**, 해당 NCG 프로젝트의 SQL 편집기에서 UID를 확인하여 등록합니다. 다음 SQL은 등록 대상 이메일을 정확히 대조합니다.

```sql
insert into public.ncg_admins (user_id)
select id from auth.users
where lower(email) = 'infonewlighch@gmail.com'
  and email_confirmed_at is not null
on conflict do nothing;
```

이 작업은 아직 실행하지 않았습니다. 운영자는 검수한 예배·설교 영상 게시, 공동 QT 초안·언어별 묵상 안내·검수 후 발행과 보류 메시지·신고·계정 활동제한을 다룰 수 있으며, 일반 대화 전체를 관리자 목록에 노출하지 않습니다. 기본 필터는 일부 금칙어·링크·반복문자·전송속도를 검사합니다. 모든 언어의 문맥 검수가 완성된 것은 아닙니다.

## 성경과 번역

- WEBP: [공식 원문](https://ebible.org/engwebp/), [사용 조건](https://ebible.org/engwebp/copyright.htm). 원문 단어를 바꾸지 않고 XML표시/공백을 정리하며 각주와 시편 표제를 구분합니다. 출처·해시는 `public/bibles/webp/provenance.json`에 있습니다.
- YouVersion: [공식 Bible API](https://developers.youversion.com/api/bibles). 앱의 사용허가 범위에 든 역본만 받아 모든 페이지를 조회합니다. 저작권/출판사 정보를 표시하며, 사용허가 없는 본문을 임의로 생성하지 않습니다. 실제 API 키와 제공자 연동은 아직 미완료입니다.
- 한국어 기본 역본은 개역개정(NKRV)을 우선하도록 구현했습니다. 본문 사용허가·공급자 연결 전에는 대한성서공회 공식 개역개정 해당 장으로 연결하며, 개역한글(KRV)을 개역개정이라고 표시하지 않습니다.
- 번역 브리지는 서버 환경변수로 연결합니다. 별도 Node 운영 서버에 로그인·RLS·공개 원문 확인·이용량 제한을 구현했습니다. 아직 실제 공급자는 미연결입니다. [운영 서버 문서](docs/production-server.md)를 참고하세요. Vite 개발/preview 서버는 공개 운영에 사용하지 않습니다.

## 매일 QT 알림

기기별 현지 시각/시간대 설정, 서버 구독 소유권, 매일 중복 방지, 만료 구독 비활성화, SW 알림 수신·날짜별 QT 열기를 구현했습니다. Supabase 스키마는 적용됐으며 **VAPID/예약 작업은 미연결이고 알림을 발송하지 않았습니다.** 설정·제약·검증 순서는 [알림 운영 문서](docs/push-reminders.md)를 따릅니다.

## 검증과 남은 작업

Vitest는 실제 PostgreSQL 호환 PGlite에서 RLS를 실행해 제3자 메시지 열람·무단 쓰기·권한상승·차단·신고·관리자 검수 격리를 확인합니다. 그 밖에 원본 데이터 무결성·언어 설정·성경 장절 연결·퀴즈 정답 보존·미디어 URL·서버 오류를 검사합니다. 원격 배포 환경의 실계정 검증을 대신하지 않습니다.

공개 미리보기는 Netlify 정적 업로드입니다. 서버 함수는 아직 배포하지 않았으며, 실제 성경 API·번역 공급자는 연결 전입니다. 공식 도메인과 확정 OG 이미지 배포 및 GitHub 최초 백업은 완료했습니다. 남은 핵심은 Google/이메일 인증 검증, 허가된 다국어 성경/화면 번역 확장, QT 교회 검수·발행, 푸시 운영 연결과 실제 계정 통합 검증입니다. 지속 기록은 로컬 `docs/WORKLOG.md`를 봅니다.

## 운영 주체

대한예수교장로회(합동) 경기동중노회 · 새빛교회

대한민국 경기도 광명시 하안동 200-1, 4층 · infonewlighch@gmail.com

NCG 자체 제작 콘텐츠의 저작권은 새빛교회에 있습니다. 제3자 성경 역본·소프트웨어·공개 자료의 권리와 출처는 별도로 유지합니다.
