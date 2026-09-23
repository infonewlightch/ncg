# 매일 QT 알림 운영 연결

## 구현 상태

QT/마이페이지에 기기별 알림 설정 UI가 있습니다. 사용자가 버튼을 눌러 허용할 때만 구독합니다. NCG Supabase와 003 SQL은 운영 프로젝트에 이미 연결·적용되어 있습니다. **VAPID·작업자 비밀키·활성화 플래그와 실제 기기 수신 검증은 아직 준비되지 않았으며, 외부 푸시를 보내지 않았습니다.**

Netlify `qt-reminders` 함수는 1분 간격의 예약 실행으로 구성되어 있습니다. `NCG_QT_PUSH_ENABLED=1`과 필요한 설정이 모두 일치하지 않으면 데이터베이스 청구나 발송 없이 종료합니다. `/api/push-status`는 공개키와 설정 준비 여부만 반환하며 캐시하지 않습니다. 설정 확인은 실제 DB 자격증명 유효성이나 최종 수신을 증명하지 않습니다.

화면은 HTTPS production build, 공개키, 서버 설정 확인을 모두 거쳐야 켜기 버튼을 활성화합니다. 조회 실패 시 재확인할 수 있고, 기존 기기의 끄기는 발송 서버가 중지되어도 사용할 수 있습니다. 계정별로 화면 상태를 분리하고 요청 시작 계정의 인증 토큰을 고정합니다. 계정 전환 후 늦게 도착한 응답은 표시하지 않으며, 아직 끝나지 않은 구독 생성은 정리합니다. 설정 중 시간·시간대 입력과 반복 클릭을 잠급니다.

003 마이그레이션은 구독 소유권과 서버 작업자의 발송 권한을 분리합니다. 다른 사용자의 endpoint/암호화 키를 읽거나, 일반 회원이 발송 작업을 가져갈 수 없습니다. 로그아웃하면 이 기기의 구독을 해제합니다. 사용자는 알림을 켠 각 기기에서 시간·시간대를 정합니다. 여행으로 시간대가 바뀌면 설정에서 갱신할 수 있습니다.

## 준비 순서

1. NCG 전용 Supabase `yndtcpsajhmnyeqeozju`의 001–011 SQL은 이미 적용되어 있습니다. 다시 실행하지 않습니다. 다른 앱 DB를 사용하지 않습니다.
2. 공식 `web-push` 라이브러리로 VAPID 키 쌍을 한 번 생성해 서버 비밀 저장소에 보관합니다. 공개 키만 프런트 빌드에 넣습니다. 키 쌍을 바꾸면 기존 브라우저의 재구독이 필요합니다.
3. Netlify에서 `VITE_VAPID_PUBLIC_KEY`는 Build와 Functions 범위에, `NCG_SUPABASE_URL`, `NCG_SUPABASE_SERVICE_ROLE_KEY`, `NCG_VAPID_PUBLIC_KEY`, `NCG_VAPID_PRIVATE_KEY`는 Functions 범위에 설정합니다. 서비스 키와 개인 키는 절대로 `VITE_`로 시작하지 않습니다. URL은 `https://yndtcpsajhmnyeqeozju.supabase.co`, 양쪽 공개키는 동일해야 하고 개인키에서 도출한 공개키도 일치해야 합니다. 초기 플래그 `NCG_QT_PUSH_ENABLED=0`을 유지합니다.
4. 검수한 공동 QT를 관리자 화면에서 발행합니다. 미발행 날짜에는 발송하지 않습니다.
5. 키와 검수 본문을 준비한 뒤 `NCG_QT_PUSH_ENABLED=1`을 Functions 범위에 설정하고 재배포합니다. Netlify Functions에서 `qt-reminders`의 Scheduled 표시와 실행 기록을 확인합니다. 공개된 production 배포에서만 주기 실행되며 외부 URL로 직접 호출할 수 없습니다. `npm run push:dispatch`는 별도 Node 환경에서 같은 작업자를 한 번 실행하는 명령입니다. 두 스케줄러를 동시에 운영하지 않습니다.
6. 검증용 계정·기기에서 구독→현지 시각 도달→수신→해당 날짜 QT 열기→알림 끄기→재발송 없음까지 확인합니다. iOS/iPadOS는 지원 OS와 홈 화면 설치 조건을 따릅니다.

현재 작업자는 한 번에 최대 4기기를 동시에 처리합니다. DB 요청에는 5초 제한과 redirect 거부, push 요청에는 15초 timeout이 있습니다. Netlify의 30초 제한을 고려한 미리보기용 용량이며 전 세계 대규모 발송량을 충족한다고 주장하지 않습니다. 운영 확장 시 시간대별 대기량·3시간 기한·실패율을 확인해 별도 큐/작업자로 확장해야 합니다.

## 시간과 재시도

- 공통 본문 날짜는 한국시간(UTC+9) 기준입니다. 알림 시간은 각 기기에 저장한 IANA 시간대 기준입니다.
- 설정 시간 이후 최대 3시간 이내에 해당 날짜의 발행된 QT를 찾습니다. 이 범위를 넘긴 오래된 알림은 보내지 않습니다.
- 일광절약시간 시작으로 설정 시각이 사라지면 전환 후 시간에 처리할 수 있습니다. 반복되는 시각에도 기기/현지 날짜 및 기기/공통 본문 두 고유키가 중복 청구를 막습니다.
- 제공자가 수락한 발송은 `sent`, 만료 endpoint(404/410)는 구독 비활성화, 429/5xx는 5분 후 최대 총 3회 시도합니다.
- 응답을 받지 못한 경우는 수락 여부가 불명확해 `uncertain`으로 남기며 자동 재발송하지 않습니다. 발송 결과를 DB에 기록하다가 오류가 나도 다른 청구 건은 계속 처리하며 `acknowledgementFailures` 집계와 함수 실패로 운영 확인을 요청합니다. 작업자 종료로 남은 `leased`와 기록 실패도 운영자가 확인해야 합니다. 정확히 한 번의 최종 수신을 보장한다고 주장하지 않습니다.
- Web Push topic과 알림 tag는 같은 날짜의 알림을 묶습니다. 잠금 화면에는 묵상 제목만 표시하며, 사용자 개인 글이나 채팅은 넣지 않습니다.
- 구독 endpoint는 FCM/Mozilla/Apple/Windows의 명시된 HTTPS push 호스트만 허용합니다. 새 브라우저 제공자를 지원할 때는 SQL과 작업자 허용 목록을 함께 검수해 확장합니다.

## 배포 전 확인할 점

실제 발송 지연·전 세계 시간대·브라우저별 권한·계정 전환·키 교체·예약 작업 장애를 운영 환경에서 확인해야 합니다. 운영 통계에는 집계 숫자만 남기며, 구독 URL이나 암호화 키를 출력하지 않습니다. 전달 기록 보관 기간과 삭제 작업은 아직 운영 정책으로 정하지 않았습니다.

공식 근거: [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [web-push 프로젝트](https://github.com/web-push-libs/web-push), [Apple Web Push 안내](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
