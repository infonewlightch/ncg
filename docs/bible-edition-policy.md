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
- getBible는 같은 ASV 1901의 Public Domain 공급본만 허용. 나머지 전체 목록은 추가 검토 전 제외.

개역개정은 대한성서공회 외부 읽기 링크만 제공합니다. NIV/개역개정 앱 내 전문 및 YouVersion 역본은 사용허가/공급본 검토 완료 전 활성화하지 않습니다.

새 역본은 번역 주체·출판사·정경·역본 계보·이용허가를 검토한 뒤 정확한 ID로 추가합니다. 자동 수집한 목록은 후보 자료일 뿐 제공 허가 목록이 아닙니다. 자동 참고 번역은 공식 성경 역본으로 표시하지 않습니다.
