# WhoAreU

Windows에서 **현재 실행 중인 프로그램**이 어디서 왔는지, 얼마나 큰지, 언제 설치됐는지 한눈에 보여주는 트레이 앱.

> 상태: 1차 계획 (코드 미작성)

---

## 무엇을 하는 앱인가

내 PC에서 지금 돌고 있는 프로세스 중 **사용자 앱**만 골라서, 각 프로세스의 출처/크기/설치일을 표로 보여준다.
"이 프로세스 뭐지?" 싶을 때 작업 관리자보다 한 단계 더 친절한 정보를 주는 것이 목표.

### 표시 항목

| 컬럼 | 출처 |
|------|------|
| 이름 | 프로세스명 / 표시 이름 (`DisplayName`) |
| 출처 | 게시자 (`Publisher`) + 실행 파일 경로 |
| 디스크 용량 | 레지스트리 `EstimatedSize` 또는 설치 폴더 실측 |
| 메모리 사용량 | `WorkingSet64` (실시간) |
| 설치일 | 레지스트리 `InstallDate` |
| PID | 프로세스 ID |

### 필터링 규칙

- **포함**: 일반 사용자 앱 프로세스
- **제외**:
  - `C:\Windows\` 하위 경로에서 실행되는 시스템 프로세스
  - 경로를 읽을 수 없는 보호된 시스템 프로세스
  - 알려진 시스템 프로세스 (svchost, csrss, smss, wininit 등)

---

## 사용자 인터랙션

### 트레이 아이콘
- 앱은 트레이에 상주. 메인 창은 기본적으로 숨겨져 있음.
- 트레이 우클릭 메뉴:
  - **확인하기** — 대시보드 창 표시
  - **종료** — 앱 완전 종료
- 트레이 좌클릭 = 확인하기와 동일

### 대시보드 창
- 프로세스 목록 테이블
- 검색 / 정렬 / 컬럼 필터
- **새로고침 모드 토글**:
  - 수동: 새로고침 버튼 클릭 시에만 갱신
  - 자동: N초 주기 갱신 (메모리 등 실시간 값에 적합)
- 창 닫기(X) = 숨기기 (트레이로 들어감, 종료 아님)

---

## 기술 스택

| 영역 | 선택 |
|------|------|
| 런타임 | Electron |
| 렌더러 | **바닐라 HTML/CSS/JS** (React/Vue 등 프레임워크 미사용) |
| 시스템 정보 수집 | PowerShell (`Get-Process`, 레지스트리 `Uninstall` 키 조회) |
| 패키지 매니저 | yarn |
| 배포 | electron-builder, **portable (미설치) 단일 exe** |

### 왜 PowerShell인가
네이티브 노드 모듈(`ffi-napi`, `node-windows` 등) 의존성을 피하고, Electron 재빌드 부담 없이 Windows 관리 정보를 가져오기 위함. `child_process.spawn`으로 호출하고 JSON으로 결과 수신.

### 왜 portable 빌드인가
설치 과정 없이 exe 하나로 동작. 사용자가 받자마자 실행 가능.

---

## 모듈 구조 (예정)

```
whoAreU/
├── main.js                    # Electron 메인 프로세스 (Tray, BrowserWindow, IPC)
├── preload.js                 # contextBridge로 IPC 안전 노출
├── src/
│   ├── system/
│   │   ├── processes.js       # 실행 중 프로세스 수집
│   │   ├── installed.js       # 레지스트리 설치 정보 수집
│   │   └── index.js           # 둘을 매칭/필터링하는 파사드
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       └── app.js             # 바닐라 JS 대시보드 로직
├── scripts/
│   └── make-icon.js           # 트레이 아이콘 placeholder 생성
├── assets/
│   └── tray-icon.png
└── package.json
```

---

## 실행 / 빌드 (구현 후)

```powershell
yarn install      # postinstall로 트레이 아이콘 placeholder 자동 생성
yarn start        # 개발 실행
yarn build        # portable exe 빌드 → dist/WhoAreU-0.1.0-portable.exe
```

---

## 작업 단계

- [x] 1차 계획 합의 (이 문서)
- [ ] `package.json` / `.gitignore`
- [ ] 시스템 정보 수집 모듈 (`src/system/*`)
- [ ] 메인 프로세스 + Tray + IPC (`main.js`, `preload.js`)
- [ ] 바닐라 렌더러 대시보드 (`src/renderer/*`)
- [ ] 트레이 아이콘 생성 스크립트 (`scripts/make-icon.js`)
- [ ] 실행 검증 (`yarn start`)
- [ ] portable 빌드 검증 (`yarn build`)

---

## 향후 검토 (2차 이후)

- 코드 서명 인증서로 게시자(Publisher) 검증 표시
- 의심 프로세스 하이라이트 (서명 없음 / 임시 폴더 실행 / 알려지지 않은 게시자)
- 프로세스 종료 / 설치 폴더 열기 컨텍스트 메뉴
- 자동 시작 등록 (Windows 시작 시 트레이 상주)
