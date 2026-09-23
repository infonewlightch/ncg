# SNS 공유 썸네일

## 최종 OG 선택 — 사용자가 지정한 NCG.png

- 사용자가 `NCG.png`를 지정하며 "이것을 og로 써"라고 확정했다.
- 원본을 수정·리사이즈 없이 `public/brand/ncg-og-final.png`로 복사했다. 1800×945 PNG.
- 원본과 배포 파일 SHA-256: `caf709a6ccc8e4bbecc88f2a5f69fcf13e83f3d47a6be695ecebccf38ed8c9b1`.
- Open Graph/Twitter의 이미지 URL과 크기를 이 파일로 변경했다. 사이트명 `NCG`, 설명 `One Gospel. Every Nation. Every Language.` 유지.
- 아래 SVG/PDF는 벡터 원본 제공용으로 보존한다.
- 2026-09-24 01:28 Netlify 배포 `6ab3fe28cbfaec2c42035da3` 완료. 공식 홈페이지와 이미지 모두 HTTP 200, PNG MIME, 배포 이미지와 원본의 SHA-256 일치를 확인했다.
- 공식 OG URL은 `https://newlightchurchglobal.com/brand/ncg-og-final.png`다. HTML의 NCG 제목, 슬로건 설명, 이미지 크기 1800×945를 실제 공개 응답으로 확인했다. SNS 플랫폼의 기존 캐시는 별도 갱신될 수 있다.

## 벡터 원본 제작 — 흰 배경

- 사용자 최종 지시: 새로 첨부한 NCG 로고의 형태와 금색 점 위치를 기준으로 흰 배경에 벡터화. `NEWLIGHT CHURCH GLOBAL` 필수. 풀네임은 N 왼쪽부터 G 오른쪽까지 정렬.
- 원본: `output/brand/ncg-reference.jpg`. 저해상도 JPEG의 울퉁불퉁한 윤곽을 그대로 확대하지 않고 N의 직선과 C/G의 곡선을 다듬은 경로로 재구성했다. 원본 벡터가 없어 수작업으로 재구성한 윤곽이다.
- 벡터 원본: `output/brand/ncg-wordmark-white-vector.svg`와 같은 이름의 PDF. 1200×630 비율, 남색 `#123564`, 금색 `#BE8F3E`, 흰색 `#FFFFFF`.
- 모든 글자는 윤곽선 경로다. PDF 1페이지, 비트맵 이미지 0개, 폰트 리소스 0개를 확인했고 PDF를 렌더링해 외형을 검수했다.
- 웹용 SVG: `public/brand/ncg-wordmark-white-vector.svg`. SNS 호환용 PNG: `public/brand/ncg-social-share-white.png`, 1200×630. 3배 크기 미리보기는 `output/brand/ncg-wordmark-white-vector-preview.png`.
- 벡터 제작 당시 1200×630 PNG를 함께 만들었다. 최종 Open Graph/Twitter 이미지는 위 사용자가 지정한 `NCG.png`다.
- 사용자가 벡터/PDF를 명시해 생성형 이미지 대신 SVG 경로와 PDF 벡터로 제작했다. 배경은 완전한 단색 흰색이다. 공개 배포 전.

## 이전 공유 설정 — v11

- 사이트명/브라우저 제목/설치 이름/Open Graph/Twitter 제목: **NCG**.
- 짧은 설명/Open Graph/Twitter 설명: **One Gospel. Every Nation. Every Language.**
- 현재 선택 파일: `public/brand/ncg-social-share-v11.png`, 1721×914 PNG. 내장 image_gen으로 수정.
- 사용자의 추가 요청으로 슬로건을 이미지에서 지우고, N의 손상된 윤곽을 원본 로고 기준으로 재생성했다. 로고 크기는 큰 버전과 작은 버전 사이로 맞췄으며 영문 풀네임을 로고 너비에 맞췄다. 웹앱의 슬로건 텍스트와 교회 십자가 심볼은 유지한다.
- 이미지에 다시 얼룩을 넣으려는 의도는 없다. 생성 이미지의 배경은 화면상 확인했으며 단색 픽셀의 완전 일치까지 확인한 것은 아니다.
- 공개 배포 전. 이전 버전 파일은 원본 보존용이다.

### v11 최종 편집 프롬프트

Precise typography alignment edit to this NCG graphic. Change ONLY the smaller subtitle line 'NEWLIGHT CHURCH GLOBAL'. Reduce and adjust that line's font size and letter spacing so its LEFT edge aligns exactly with the LEFT vertical outside edge of the large letter N above, and its RIGHT edge aligns exactly with the RIGHT outside edge of the large letter G above (excluding the separate decorative gold full stop). The subtitle must occupy the same horizontal span as the THREE WHITE LETTERS NCG; it must no longer extend farther left or farther right than those white letters. Keep the subtitle directly below NCG, with a comfortable clean vertical gap. Preserve the exact text, solid white color, crisp sans-serif style, and all 21 letters. Preserve the large NCG letters and gold dot completely unchanged: exact clean shapes, size, and position, especially N's intact straight diagonal. Preserve full wide canvas, navy background, and all other spacing. No slogan, URL, cross, border, guide line, icon, or new element. The result should be a clean professional two-line aligned wordmark lockup. Return only one finished edited graphic.

## 이전 수정본 v4

- 현재 선택 파일: `public/brand/ncg-social-share-v4.png`, 1730×909 PNG. 내장 image_gen으로 수정.
- 사용자 마스크 요청에 따라 v2에서 하단 곡선/도메인 삭제, v3에서 왼쪽 십자가/곡선 심볼 삭제. 이어서 비율 재조정 요청에 따라 v4에서 남은 NCG/영문명/슬로건을 중앙 정렬하고 여백 조정. 앱의 다른 교회 심볼은 변경하지 않음.
- Open Graph/Twitter 참조와 이미지 설명을 v4에 맞췄으며 아직 공개 배포 전이다. v1/v2 원본은 보존.

### v4 최종 편집 프롬프트

Rebalance the provided finished NCG social-sharing graphic. Keep the wide 1730x909 canvas (approximately 1.91:1 Open Graph ratio) and exact navy background/color character. The cross, gold horizon ornament, and URL were intentionally removed and MUST remain absent. The only elements should be white 'NCG' with its gold full stop, 'NEWLIGHT CHURCH GLOBAL', and 'One Gospel. Every Nation. Every Language.' Preserve exact wording, spelling, letterforms, white/gold colors. Correct the currently right-offset NCG block: center the NCG. wordmark horizontally at x=865, centered on the entire canvas. Center its NEWLIGHT CHURCH GLOBAL subtitle directly beneath it on the same center axis. Preserve a strong large NCG wordmark approximately 630px wide and 195px high; place the main wordmark at roughly y=245-440, subtitle baseline around y=495. Center the slogan on the same axis below with ample gap, at roughly y=595-635, adjusting its width to about 72% of the canvas and its font size proportionately for a calm, readable hierarchy. Treat all text as one beautifully balanced central composition with equal left and right negative space, generous top and bottom margins, and no awkward gap left by the removed cross. Precise typography and spacing, restrained premium church identity. Do not add any cross, icon, URL, line, frame, decorative element, photograph or extra words. Return a single clean final graphic, not a mockup or presentation.

## 최초 제작 기록 (v1)

- 결과: `public/brand/ncg-social-share-v1.png`, PNG 1730×909, 약 1.90:1.
- 입력: 사용자가 제공한 NCG 로고 `1-사진-1.jpg`.
- 제작 도구: 내장 `image_gen` (CLI/API 대체 경로 사용하지 않음).
- 원본 로고 파일은 변경하지 않았다. 금색 십자가·지평선·마침표, 남색, NCG 영문 명칭, 사용자 지정 슬로건과 도메인을 사용했다.
- `index.html`의 Open Graph/Twitter 큰 이미지에 연결했다. 실제 배포 전에는 공개 링크에 반영되지 않는다.
- 현재 공유 이미지 절대 URL은 접속 가능한 Netlify 미리보기 주소다. 공식 도메인 DNS/HTTPS 확인 후 `og:url`과 이미지 URL을 공식 주소로 전환한다.
- 생성 결과의 문구와 철자를 시각 확인했다. 플랫폼별 캐시·미리보기 갱신은 실제 공개 후 별도 확인한다.

## 최종 제작 프롬프트

Use case: compositing / ads-marketing. Create ONE finished production-quality Open Graph / SNS link-sharing thumbnail for NEWLIGHT CHURCH GLOBAL, using the attached NCG logo as the actual brand identity. The input image is a logo compositing reference, not a layout to enlarge as-is. Wide landscape canvas, target 1200 x 630 pixels (1.905:1). Flat deep navy background #123564, generous calm negative space, exceptionally crisp restrained modern typography, warm gold #C89A43 accents. Preserve the reference's exact distinctive Christian cross standing on a slender curved golden horizon, the NCG letter shapes, gold full stop, and the exact NEWLIGHT CHURCH GLOBAL wording. Use a white version of the NCG wordmark and pale cool-white small caps subtitle for contrast against navy, retaining the gold dot and gold cross/horizon. Arrange the logo lockup prominently in the optical center, with gold cross/horizon on the left and the large NCG. wordmark on the right, matching the original lockup's proportions. No white logo card, no borders or shadows. Below, with substantial breathing room, add this exact short line in elegant, legible sans serif: "One Gospel. Every Nation. Every Language." At bottom center, quietly and clearly add "newlightchurchglobal.com". Keep all important content inside a generous 100px safe margin. Delicate, almost imperceptible gold horizon accent can echo the logo, but avoid any extra symbol or ornament. This is a sacred, welcoming, global Christian church service: Jesus Christ's cross is the visual center. No photographs, people, world map, globe, extra crosses, app mockup, icons, decorative stars, textures, 3D, gradients, glow, marketing badges, or invented text. Final result must be a single polished standalone share image, not a design presentation or multiple variants.
