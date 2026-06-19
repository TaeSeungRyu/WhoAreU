# WhoAreU — 개발 계획

> 1차 계획 (코드 미작성). 합의 후 단계별 구현 예정.

---

## 1. 범위와 결정 사항

| 항목 | 결정 | 비고 |
|------|------|------|
| 표시 대상 | 실행 중인 프로세스만 | Windows 시스템 프로세스는 제외 |
| 크기 표시 | 디스크 설치 용량 + 메모리 사용량 둘 다 | 두 개 컬럼으로 분리 |
| 새로고침 | 수동 + 자동 토글 | 자동 모드 기본 주기 5초 (조정 가능) |
| 패키지 매니저 | yarn | |
| 렌더러 | 바닐라 HTML/CSS/JS | React/Vue 등 프레임워크 미사용 |
| 배포 | electron-builder `portable` 타겟 | 단일 exe, 설치 불필요 |

### 필터링 규칙 (시스템 프로세스 제외)

- `C:\Windows\` 하위 경로 실행 프로세스 제외
- 경로를 읽을 수 없는 보호된 프로세스 제외
- 이름 기반 화이트리스트 제외: `svchost`, `csrss`, `smss`, `wininit`, `services`, `lsass`, `winlogon`, `dwm`, `fontdrvhost`, `System`, `Registry` 등

### 표시 컬럼 (대시보드)

| 컬럼 | 소스 |
|------|------|
| 이름 | 프로세스명 / 레지스트리 `DisplayName` |
| 출처 | `Publisher` + 실행 파일 경로 |
| 디스크 용량 | 레지스트리 `EstimatedSize` (KB) → MB/GB 변환 |
| 메모리 | `Get-Process.WorkingSet64` |
| 설치일 | 레지스트리 `InstallDate` (YYYYMMDD 파싱) |
| PID | 프로세스 ID |

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│ Electron Main Process (main.js)                         │
│ ─ Tray 생성 / 메뉴 관리                                 │
│ ─ BrowserWindow 표시/숨기기                             │
│ ─ IPC handle: 'system:list'                             │
│           │                                             │
│           ▼                                             │
│ src/system/index.js  ─ 프로세스 + 설치정보 매칭/필터링  │
│   ├─ processes.js  ─ PowerShell Get-Process            │
│   └─ installed.js  ─ PowerShell 레지스트리 Uninstall 키 │
└─────────────────────────────────────────────────────────┘
              ▲
              │ contextBridge (preload.js)
              │ window.whoAreU.list()
              ▼
┌─────────────────────────────────────────────────────────┐
│ Renderer (src/renderer/)                                │
│ ─ index.html  ─ 테이블, 검색, 토글                      │
│ ─ styles.css                                            │
│ ─ app.js     ─ 바닐라 JS 렌더/정렬/필터                 │
└─────────────────────────────────────────────────────────┘
```

### 왜 PowerShell인가
네이티브 노드 모듈(`ffi-napi`, `node-windows` 등)에 의존하지 않기 위함. Electron 버전 업그레이드 시 재빌드 부담이 사라지고, Windows 관리 정보(WMI, Registry)를 가장 간결하게 가져올 수 있음. `child_process.spawn`으로 호출하고 `ConvertTo-Json`으로 결과 수신.

### 보안
- `contextIsolation: true`, `nodeIntegration: false`
- 렌더러는 `preload.js`가 노출한 화이트리스트 API만 사용
- PowerShell 호출 시 사용자 입력을 인자로 받지 않음 (인젝션 표면 없음)

---

## 3. 파일 구조

```
whoAreU/
├── main.js                    # Electron 메인 (Tray, BrowserWindow, IPC)
├── preload.js                 # contextBridge로 IPC 안전 노출
├── src/
│   ├── system/
│   │   ├── processes.js       # 실행 중 프로세스 수집
│   │   ├── installed.js       # 레지스트리 설치 정보 수집
│   │   └── index.js           # 매칭/필터링 파사드
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── scripts/
│   └── make-icon.js           # 트레이 아이콘 placeholder 생성 (postinstall)
├── assets/
│   └── tray-icon.png          # placeholder (사용자가 교체 가능)
├── doc/
│   └── PLAN.md
├── package.json
├── .gitignore
└── README.md
```

---

## 4. 데이터 매칭 전략

`Get-Process`로 얻은 실행 파일 경로(`Path`)와, 레지스트리 Uninstall 키의 `InstallLocation` / `DisplayIcon`을 매칭한다.

**매칭 우선순위**
1. 프로세스 경로가 `InstallLocation` 하위에 있는가
2. 프로세스 경로가 `DisplayIcon` 경로의 디렉터리와 일치하는가
3. 매칭 실패 시 — 프로세스명만 표시, 설치 정보는 빈 칸

레지스트리 조회 대상 키:
- `HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*`
- `HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*`
- `HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*`

---

## 5. IPC 계약

| 채널 | 방향 | 페이로드 |
|------|------|----------|
| `system:list` | renderer → main | `() => Promise<Process[]>` |

```ts
type Process = {
  pid: number;
  name: string;          // DisplayName 우선, 없으면 ProcessName
  exePath: string | null;
  publisher: string | null;
  installDate: string | null;   // ISO date
  diskBytes: number | null;     // EstimatedSize * 1024
  memoryBytes: number;          // WorkingSet64
}
```

---

## 6. 작업 단계

- [x] 1차 계획 합의 (이 문서)
- [ ] `package.json` / `.gitignore` (electron, electron-builder, yarn 스크립트, portable 빌드 설정)
- [ ] `scripts/make-icon.js` (postinstall에서 트레이 아이콘 placeholder 생성)
- [ ] `src/system/processes.js` (Get-Process 호출)
- [ ] `src/system/installed.js` (레지스트리 Uninstall 키 조회)
- [ ] `src/system/index.js` (매칭/필터링 파사드)
- [ ] `main.js` + `preload.js` (Tray, BrowserWindow, IPC)
- [ ] `src/renderer/*` (대시보드 UI)
- [ ] `yarn start` 동작 검증
- [ ] `yarn build` portable exe 빌드 검증

---

## 7. 향후 검토 (2차 이후)

- 코드 서명 인증서 기반 게시자 검증 표시
- 의심 프로세스 하이라이트
  - 서명 없음
  - 임시 폴더(`%TEMP%`, `%APPDATA%\Local\Temp`)에서 실행
  - 알려지지 않은 게시자
- 프로세스 컨텍스트 메뉴 — 종료, 설치 폴더 열기, 게시자 페이지 열기
- Windows 시작 시 자동 트레이 상주
- 다국어 (현재 한국어 기준 작성)
