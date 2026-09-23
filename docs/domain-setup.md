# NCG 공식 도메인 연결 상태

2026-09-24 01:26 KST 기준. 사용자가 가비아에서 구입한 도메인은 `newlightchurchglobal.com`이다.

- 공개 개발 미리보기: https://ncg-newlight.netlify.app/
- Netlify 프로젝트: https://app.netlify.com/projects/ncg-newlight/domain-management
- 기본 도메인 `newlightchurchglobal.com`, 자동 이동 별칭 `www.newlightchurchglobal.com` 등록 완료.
- 가비아 로그인 완료. 해당 도메인의 기존 레코드는 0개였고 네임서버는 `ns.gabia.co.kr`였다.
- 01:23:49 가비아에 A `@ → 75.2.60.5`, CNAME `www → ncg-newlight.netlify.app.` 2개를 TTL 600으로 저장한 화면을 확인했다. 네임서버와 다른 도메인은 변경하지 않았다.
- Netlify는 01:24에 Let's Encrypt 인증서를 자동 발급했고 apex와 www가 모두 포함된 `HTTPS enabled` 상태를 확인했다.
- 01:25 실제 DNS A/CNAME 응답을 확인했다. HTTPS apex는 200, HTTP apex와 HTTPS www는 공식 HTTPS apex로 301 이동한다. 인증서 검증을 끄지 않고 확인했다.
- 저장 전 DNS `SERVFAIL` 및 권한 서버 `REFUSED` 상태는 해소됐다.

## 가비아에서 확인할 값

2026-09-24 Netlify 해당 프로젝트의 안내 화면에서 확인한 값이다. 적용 직전 기존 레코드와 현재 Netlify 안내를 대조한다.

| 호스트 | 유형 | 대상 |
|---|---|---|
| @ | A | 75.2.60.5 |
| www | CNAME | ncg-newlight.netlify.app. |

ALIAS/ANAME/CNAME flattening을 지원하는 DNS라면 apex에 `apex-loadbalancer.netlify.com`을 사용하는 것이 Netlify 권장 설정이다. apex 일반 CNAME을 임의로 만들지 않는다.

가비아에서 도메인 사용 상태, 네임서버, DNS 관리 서비스가 활성화되어 있는지 먼저 확인한다. 기존 메일 MX, SPF/DKIM/DMARC TXT, 다른 서비스 서브도메인은 보존한다. 기존 A/AAAA/www 레코드와 충돌 여부를 확인한다. DNS 전체 이전이나 네임서버 전체 교체는 필요성을 따로 판단한다.

## 인증과 완료 기준

Supabase Site URL을 `https://newlightchurchglobal.com`으로 변경했다. 정확한 callback/admin 경로 7개(미리보기/공식 도메인/www callback/localhost4310)를 유지했다. wildcard는 사용하지 않았다. 실제 Google/이메일 로그인 왕복 검증은 인증 공급자 설정 이후에 진행해야 한다.

1. DNS가 Netlify 대상으로 응답한다.
2. Netlify DNS 검증이 성공하고 인증서에 apex와 www가 포함된다.
3. 실제 https://newlightchurchglobal.com/ 에서 브라우저 경고 없이 앱이 열린다.
4. www 및 HTTP 요청이 공식 HTTPS 주소로 이동한다.
5. Supabase 기본 Site URL을 공식 HTTPS 주소로 바꾸고 실제 로그인 복귀를 검사한다.

DNS 저장만으로 완료 처리하지 않는다. 전파·인증서 발급 지연 시 현재 관찰한 상태를 사용자에게 정확히 알린다.
