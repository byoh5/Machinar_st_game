# Machinar MVP

머쉬나리움 스타일의 2D 퍼즐 어드벤처 웹 MVP입니다.

## Local Run

```bash
npm install
npm run dev
```

## 실사 배경 자동 적용

1. 실사 배경 8장을 `public/assets/backgrounds/photos/`에 넣습니다.
2. 파일명은 씬 ID와 같게 둡니다. 예: `scrap_yard.webp`, `city_gate.webp`
3. 아래 명령으로 자동 반영합니다.

```bash
npm run backgrounds:apply-photo
```

검증만 하고 파일 변경은 하지 않으려면:

```bash
npm run backgrounds:check-photo
```

프롬프트 템플릿은 `docs/photoreal-background-prompts.md`를 참고하세요.

## GitHub Pages 자동 배포

이미 `.github/workflows/deploy-pages.yml`가 포함되어 있고,
`npm run deploy:pages`로 리포지토리 생성/푸시/배포 트리거까지 자동화되어 있습니다.

### 1) GitHub CLI 로그인 (최초 1회)

```bash
gh auth login
```

### 2) 자동 배포 실행

```bash
npm run deploy:pages
```

스크립트가 수행하는 작업:
- git repo가 없으면 자동 `git init`
- `npm run build` 검증
- 변경사항 커밋
- 원격 `origin`이 없으면 GitHub repo 생성 (`gh repo create`)
- `main` 브랜치 push
- `deploy-pages.yml` 워크플로우 트리거

### 3) 배포 URL 확인

스크립트 종료 시 예상 URL을 출력합니다.
예시:
- 유저/조직 루트 repo (`username.github.io`)면 `https://username.github.io/`
- 일반 repo면 `https://username.github.io/repo-name/`

## Optional Environment Variables

`deploy:pages` 실행 전에 필요 시 지정 가능:
- `REPO_NAME`: 생성할 GitHub 저장소 이름
- `VISIBILITY`: `public` 또는 `private`
- `DEFAULT_BRANCH`: 기본 `main`
- `COMMIT_MESSAGE`: 자동 커밋 메시지

예시:

```bash
REPO_NAME=machinar-mvp VISIBILITY=public npm run deploy:pages
```
