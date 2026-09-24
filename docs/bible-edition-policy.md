# NCG 성경 역본 제공 기준

사용자 지시(2026-09-24): 개신교 정경 66권을 기준으로 제공하며 가톨릭용 역본, 교회가 수용하지 않는 교파의 역본, 성격이 불확실한 역본을 제공하지 않습니다. 제공 수보다 검증을 우선합니다.

## 적용 방식

`src/data/bible-policy.json`의 정확한 공급자별 ID 허용 목록을 화면과 서버가 함께 사용합니다. 공급자의 `certified` 또는 재배포 가능 표시만으로 통과시키지 않습니다. 역본 선택 목록과 직접 본문/API 주소 모두 제한합니다. 정경 밖의 책과 장도 차단합니다. 기존 북마크 기록은 삭제하지 않지만 제외 역본은 열 수 없습니다.

## 초기 검토한 공급본

2026-09-24에 공급자의 역본별 소개/저작권 페이지를 확인했습니다. 이는 교회 전체 신학 검수 완료나 외부 기관의 NCG 인증을 의미하지 않습니다.

- 영어 [WEB 개신교 66권판](https://ebible.org/engwebp/copyright.htm), [ASV 1901](https://ebible.org/eng-asv/copyright.htm): Public Domain. WEB 가톨릭/외경 포함판은 별도 역본이므로 제외.
- 중국어 [화합본 간체](https://ebible.org/cmn-cu89s/copyright.htm), [번체](https://ebible.org/cmn-cu89t/copyright.htm): Public Domain.
- 아랍어 [Van Dyck](https://ebible.org/arb-vd/copyright.htm): Syrian Mission 번역, American Bible Society 기여, Public Domain.
- 프랑스어 [Louis Segond 1910](https://ebible.org/fraLSG/copyright.htm), 스페인어 [Reina Valera 1909](https://ebible.org/spaRV1909/copyright.htm): Public Domain.
- 태국어 [Thai KJV](https://ebible.org/thaKJV/copyright.htm): Philip Pope 번역, CC BY-NC-ND 4.0. 출처 표시, 비영리, 원문 유지 조건.
- 포르투갈어 [Biblica Open Nova Bíblia Viva](https://ebible.org/poronbv/copyright.htm), 페르시아어 [Biblica Open Persian Contemporary Bible](https://ebible.org/pesopcb/copyright.htm), 힌디어 [Biblica Open Hindi Contemporary Version](https://ebible.org/hincv/copyright.htm): Biblica 공급, CC BY-SA 4.0. 원문·명칭·저작권과 출처 유지.
- 초기 getBible 승인은 같은 ASV 1901의 Public Domain 공급본으로 시작했습니다. 아래 추가 검토에서 일본어 문어역도 허용했으며, 나머지 목록은 검토 전 제외합니다.

개역개정은 대한성서공회 외부 읽기 링크만 제공합니다. NIV/개역개정 앱 내 전문 및 YouVersion 역본은 사용허가/공급본 검토 완료 전 활성화하지 않습니다.

새 역본은 번역 주체·출판사·정경·역본 계보·이용허가를 검토한 뒤 정확한 ID로 추가합니다. 자동 수집한 목록은 후보 자료일 뿐 제공 허가 목록이 아닙니다. 자동 참고 번역은 공식 성경 역본으로 표시하지 않습니다.

## 2026-09-24 추가 검토·연결

다음 9개 공급본을 추가합니다. 모두 정확한 공급자 목차에서 **구약 39권 + 신약 27권**, 각 권의 장 선택 목록 총 **1,189장**을 대조했습니다. 출판기관·이용 조건 확인이며 교단의 전 장절 감수 또는 현지 사용량 순위 인증을 의미하지 않습니다.

| 언어 | 공급자 ID | 판본·출처와 이용 조건 |
|---|---|---|
| 독일어 | `deu1912` | [Luther 1912](https://ebible.org/deu1912/copyright.htm), Public Domain 배포본. 현대 2017판과 구분 |
| 독일어 | `deuelo` | [비개정 Elberfelder 1905](https://ebible.org/deuelo/copyright.htm), Public Domain |
| 독일어 | `deu1951` | [Schlachter 1951](https://ebible.org/deu1951/copyright.htm), Genfer Bibelgesellschaft, CC BY 4.0 |
| 이탈리아어 | `ita1885` | [Diodati 1885](https://ebible.org/ita1885/copyright.htm), Public Domain. [이탈리아성서공회 계보](https://societabiblica.org/?page_id=71) |
| 스와힐리어 | `swhonen` | [Biblica Open Kiswahili Contemporary / Neno 2015](https://ebible.org/swhonen/copyright.htm), CC BY-SA 4.0 |
| 벵골어 | `benobcv` | [Biblica Open Bengali Contemporary](https://ebible.org/benobcv/copyright.htm), CC BY-SA 4.0 |
| 우르두어 | `urdoucv` | [Biblica Open Urdu Contemporary](https://ebible.org/urdoucv/copyright.htm), 우르두 문자·RTL, CC BY-SA 4.0 |
| 베트남어 | `vieovcb` | [Biblica Open Vietnamese Contemporary 2015](https://ebible.org/vieovcb/copyright.htm), CC BY-SA 4.0 |
| 일본어 | getBible `japbungo` | 문어역: 명치원역 구약(제공본의 저본 1953 인쇄판)·대정개역 신약. [일본성서협회 계보](https://www.bible.or.jp/online/how-to-choose.html), [CrossWire 해당 공급본 Public Domain 표시](https://www.crosswire.org/sword/copyright/ModInfoCopyright.jsp?modName=JapBungo). 현대 구어역으로 표시하지 않음 |

Biblica의 [공식 신앙고백](https://www.biblica.com/about/statement-of-faith/)에서 구신약 66권 및 복음주의 신앙고백을 확인했습니다. 이름·본문·저작권 고지·출처/라이선스 링크를 유지하며 성경 본문을 AI로 교정하거나 다른 판본과 합치지 않습니다. 벵골어 등 카탈로그에 잘못 들어 있는 `Latin` 문자 표시는 독자에게 노출하지 않습니다. 상세 권리 고지는 각 역본의 이용 안내에서 원 공급자의 내용을 유지합니다.

### 보류·제외한 후보

- 일본어 getBible `japkougo`: 책은 66권이나 **18장 누락**, 1,171장만 제공. 시편 130–139, 잠언 30–31, 마태복음 25–28, 요한복음 19, 로마서 10의 직접 본문 URL도 모두 404. 권리와 별개인 공급 결함으로 제외합니다. [공급 목차](https://api.getbible.net/v2/japkougo/books.json).
- 이탈리아어 `ita1927`: 공개 권리는 확인했지만 공급 목차의 베드로전후서 표제 중복 및 권리 페이지 부가 설명 오류가 있어 이번 추가에서 보류.
- 인도네시아어 `indayt`: [권리자 고지](https://ayt.co/hakcipta)와 공급자의 자동 라이선스 표기가 서로 달라 추가 확인 필요.
- 러시아어 Synodal: 번역 계보 추가 검토 필요. getBible 공급본은 78권이어서 승인하지 않음. Biblica NRT는 별도 공급 허가 필요.
- 터키어 `turobt` 및 말레이어 `zlmKSZI`: 현재 공개 공급본은 신약 27권. 터키어 `turytc`는 개인 WEB 중역·검토 중인 자료로 정식 기본판 후보에서 제외.

[기술 검증 기록](verification/bible-expansion-2026-09-24.json): 새 9판본의 전 권 장 목록, 승인된 온라인 공급원 20개의 대표 4장(총 80장) 실제 파싱. 전 세계 모든 역본이나 전 장절의 내용·번역 품질 감수가 완료된 것은 아닙니다.
