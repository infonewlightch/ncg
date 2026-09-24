# 모바일 영상 크기와 전체화면 개선

2026-09-24. 사용자가 Chrome에서 영상 크기와 전체화면 문제를 제보하고 인앱 및 다른 브라우저 확인도 요청했습니다.

## 원인과 수정
- 기존 390px 화면에서 대화상자 내부 폭은 340px인데 영상은 373px, 가로 스크롤 폭은 411px였습니다. 최소 높이와 종횡비가 좁은 대화상자 여백과 충돌해 오른쪽 재생 버튼 영역이 잘렸습니다.
- 모바일 영상 창은 화면 너비를 사용하고 iframe/video는 컨테이너 안에서 크기가 결정되도록 변경했습니다. YouTube 권장 최소 뷰포트 200×200을 유지하며 작은 화면에서는 여백으로 처리합니다.
- 영상 바로 아래 44px 이상 크기의 전체화면/복귀 버튼과 YouTube 원본 링크를 제공합니다. 지원 브라우저에서는 영상 영역에 Fullscreen API를 요청하고 거절되거나 지원하지 않으면 화면 확대 보기로 전환합니다. 두 모드는 문구로 구분합니다.
- iPhone 직접 호스팅 영상의 WebKit 전체화면 API도 처리합니다. YouTube의 `controls=1`, `fs=1`, iframe 전체화면 권한을 명시합니다.
- 확대/복귀 때 iframe을 다시 만들지 않습니다. 짧은 가로 화면에서 영상과 조작 버튼이 함께 보이게 조정했습니다. 영상 제목, 설명 문단과 더빙/자막 안내는 유지합니다.
- 전체화면 문구를 한국어/영어 및 기존 사전 생성 언어팩에 반영했습니다.

## 검증
- 전체 70개 테스트 파일 / **360개 테스트 통과**. 타입 검사·프로덕션 빌드 통과.
- 추가 5개 회귀 테스트: 재생 전 외부 연결 없음, YouTube 권한/매개변수, API 미지원·거절 시 확대 대체, iframe 유지와 Escape 복귀, 직접 호스팅 영상의 iPhone API 전환.
- Codex 인앱 브라우저에서 실제 페이지를 열어 다음 화면을 확인했습니다. 이 크기 검사는 실물 휴대폰 OS 검증과 구분합니다.
  - 320×740: 창 폭/스크롤 폭 모두 320px, 영상 320×200px, 두 버튼 모두 화면 안에 표시.
  - 390×844: 창 폭/스크롤 폭 모두 390px, 영상 390×219.375px. 큰 글씨 상태에서도 가로 넘침 없음.
  - 844×390 가로: 영상 약 444×250px, 조작 영역 하단 383px로 화면 안에 표시. 전체화면 전환/복귀 버튼 작동.
  - 1280×800: 영상 약 958×539px, 가운데 960px 대화상자, 조작 영역 화면 안에 표시.
- 로컬 검증에서 YouTube iframe은 검은 영역으로 표시됐습니다. 이후 **운영 사이트에서는 실제 영상 재생과 한국어 자막 진행을 확인**했습니다. 원본 embed 직접 열기는 상위 페이지 referrer가 없어 플레이어 구성 오류가 나므로 정상 임베드 실패의 근거로 삼지 않습니다.
- Chrome 브라우저 연결은 제공되지 않았고, 네이티브 Chrome/Safari 앱 검증은 Mac 잠금 때문에 진행하지 못했습니다. 사용자에게 잠금 해제를 요청했습니다. **Chrome·Safari·네이버/카카오 인앱·실물 iOS/Android 검증 완료라고 표현하지 않습니다.**

## 참고
- [YouTube 플레이어 매개변수](https://developers.google.com/youtube/player_parameters)
- [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)
- [Safari 동영상 제공](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari)

## 운영 반영
- 코드 **3e91553** main push 완료. Netlify Production `main@3e91553` **Published**, 16:44 KST 시작 / 34초 배포 확인.
- https://newlightchurchglobal.com/#/sermons 새로고침 후 390px에서 영상 390×219.375px, 가로 스크롤 없음, 전체화면/YouTube 버튼 확인.
- 실제 운영 영상의 화면과 한국어 자막이 진행되는 것을 확인했습니다. 기본 인앱 창 크기로 되돌린 뒤 **전체화면 영상이 화면에 맞게 표시되고 복귀 후 재생이 이어지는 것**을 육안 검증했습니다. 모바일 뷰포트를 강제로 적용한 상태에서는 인앱 전체화면 캡처가 작게 축소되는 도구 현상이 있어, 실제 전체화면 검증은 뷰포트 재정의 해제 상태에서 했습니다.
- 영상 창을 닫아 재생 종료, 뷰포트 재정의 해제 완료. Chrome/Safari 및 실물 모바일 브라우저 검증은 Mac 잠금 해제/실기기 접근 이후 남아 있습니다. 더빙 9개 언어 각각의 음성 청취 검증까지 수행한 것은 아닙니다.

## 잠금 해제 후 브라우저 검증과 가로 전환
- 사용자 잠금 해제 후 macOS **Chrome 153.0.8010.53** 게스트 창에서 운영 영상·자막 진행, 실제 전체화면(브라우저 종료 안내 표시), Esc 복귀 후 재생 지속을 확인했습니다.
- Chrome Device Mode에서 390×844 및 844×390 영상과 조작 버튼이 화면 안에 표시됐습니다. Pixel 9 프리셋 412×924도 확인했습니다. 이는 **Android/iPhone 실기기 Chrome 검증이 아닙니다**.
- macOS Safari에서도 영상·한국어 자막 진행, 전체화면, Esc 복귀를 확인했습니다. Safari에서 자동 재생이 멈춘 경우 YouTube 자체 재생 버튼을 누르면 정상 진행했습니다.
- 사용자가 가로 전체화면과 양쪽 모바일 OS 지원을 추가 요청했습니다. 실제 전체화면 진입 이벤트에서 `screen.orientation.lock('landscape')`를 한 번 시도하고, 종료/브라우저 복귀/컴포넌트 해제 시 `unlock()`하도록 추가했습니다. 뒤늦게 끝난 잠금이 다음 시청 세션을 풀어버리지 않도록 보호합니다.
- 지원하지 않거나 거절하는 브라우저는 전체화면을 그대로 유지합니다. 세로 터치 화면에서는 휴대폰을 가로로 돌리는 안내만 표시합니다. 화면을 임의로 90도 CSS 회전시키지는 않습니다.
- 현재 Mac의 Chrome 153 모바일 에뮬레이션에서도 `NotSupportedError: screen.orientation.lock() is not available on this device.`가 실제 확인됐습니다. 전체화면과 수동 가로보기는 정상이며, **자동 회전 실기기 성공은 아직 검증되지 않았습니다**. 진단용 콘솔 출력은 제거했습니다.
- 방향 잠금 성공/거절/늦은 완료/다음 세션 보호 테스트와 플레이어 전체화면 진입·종료 연결 검증을 추가했습니다. 전체 **71파일/364테스트** 및 타입 검사·빌드 통과.
- iOS Safari는 방향 잠금 API가 지원되지 않는 환경이 있어 강제 가로 회전을 보장할 수 없습니다. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock), [W3C](https://w3c.github.io/screen-orientation/#interaction-with-fullscreen-api). Chrome Device Mode 지원은 [공식 설명](https://developer.chrome.com/blog/new-in-devtools-147#refreshed-device-mode-toolbar)과 현 환경의 실제 거절 결과를 구분해 기록합니다.
- 직접 호스팅 파일은 현재 운영 콘텐츠가 아닙니다. 재생 전 iPhone 전용 전체화면 진입과 확대 중 파일 로드 실패 안내는 파일 영상 운영 시작 전 추가 개선 대상으로 남깁니다.
