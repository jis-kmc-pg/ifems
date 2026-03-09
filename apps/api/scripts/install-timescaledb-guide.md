# TimescaleDB Windows 설치 가이드

## 1단계: PostgreSQL 버전 확인

1. **pgAdmin 또는 SQL Shell (psql) 실행**
2. **다음 쿼리 실행**:
   ```sql
   SELECT version();
   ```
3. **PostgreSQL 버전 확인** (예: PostgreSQL 16.x, 15.x, 14.x 등)

---

## 2단계: TimescaleDB 다운로드 및 설치

### Windows용 TimescaleDB 설치

1. **공식 다운로드 페이지 방문**:
   - https://docs.timescale.com/self-hosted/latest/install/installation-windows/

2. **PostgreSQL 버전에 맞는 설치 파일 다운로드**:
   - PostgreSQL 16: `timescaledb-postgresql-16-windows-amd64.zip`
   - PostgreSQL 15: `timescaledb-postgresql-15-windows-amd64.zip`
   - PostgreSQL 14: `timescaledb-postgresql-14-windows-amd64.zip`

3. **다운로드 링크** (최신 버전 2.17.2):
   ```
   https://github.com/timescale/timescaledb/releases
   ```

4. **ZIP 파일 압축 해제**

5. **DLL 파일 복사**:
   - 압축 해제한 폴더의 `timescaledb.dll` 파일을 PostgreSQL 설치 디렉토리의 `lib` 폴더에 복사
   - 일반적인 경로: `C:\Program Files\PostgreSQL\16\lib\`

   ```powershell
   # 예시 (관리자 권한 PowerShell)
   Copy-Item "D:\Downloads\timescaledb.dll" "C:\Program Files\PostgreSQL\16\lib\"
   ```

---

## 3단계: PostgreSQL 설정 수정

1. **postgresql.conf 파일 찾기**:
   - 기본 경로: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`
   - 또는 pgAdmin → Servers → 서버 우클릭 → Properties → Advanced → Configuration file

2. **postgresql.conf 편집** (관리자 권한 필요):
   ```ini
   # shared_preload_libraries 줄 찾기 (또는 추가)
   shared_preload_libraries = 'timescaledb'
   ```

3. **선택 사항 - 성능 최적화** (postgresql.conf에 추가):
   ```ini
   # TimescaleDB 권장 설정
   max_background_workers = 16
   max_worker_processes = 16
   timescaledb.max_background_workers = 8
   ```

---

## 4단계: PostgreSQL 서비스 재시작

### 방법 1: Windows 서비스 관리자
1. `Win + R` → `services.msc` 입력
2. `postgresql-x64-16` (또는 해당 버전) 찾기
3. 우클릭 → **재시작**

### 방법 2: PowerShell (관리자 권한)
```powershell
Restart-Service postgresql-x64-16
```

---

## 5단계: TimescaleDB Extension 활성화

1. **pgAdmin 또는 psql에서 ifems 데이터베이스 연결**

2. **Extension 생성 쿼리 실행**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
   ```

3. **확인**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'timescaledb';
   ```

---

## 6단계: 하이퍼테이블 설정 스크립트 실행

TimescaleDB 설치가 완료되면 다음 명령어를 실행하세요:

```bash
cd d:/AI_PJ/IFEMS/apps/api
pnpm db:timescale
```

---

## 문제 해결

### DLL 로드 실패
- **증상**: "library timescaledb could not be loaded" 오류
- **해결**:
  1. DLL 파일이 올바른 `lib` 폴더에 있는지 확인
  2. PostgreSQL 버전과 TimescaleDB 버전 호환성 확인
  3. Visual C++ Redistributable 설치 (필요 시)

### Extension 생성 실패
- **증상**: "extension timescaledb is not available" 오류
- **해결**:
  1. PostgreSQL 재시작 확인
  2. shared_preload_libraries 설정 확인
  3. postgresql.log 파일 확인 (`C:\Program Files\PostgreSQL\16\data\log\`)

### 권한 오류
- **증상**: "permission denied" 오류
- **해결**:
  - 관리자 권한으로 실행
  - PostgreSQL 서비스 사용자가 DLL 파일 읽기 권한 보유 확인

---

## 설치 확인

설치가 완료되면 다음 쿼리로 버전 확인:

```sql
SELECT * FROM timescaledb_information.version;
```

---

## 다음 단계

1. `pnpm db:timescale` 실행 → TagDataRaw 하이퍼테이블 변환
2. `pnpm db:check` 실행 → 데이터 수집 상태 확인
3. Backend 재시작 → 1초 단위 데이터 수집 시작

---

## 참고 자료

- TimescaleDB 공식 문서: https://docs.timescale.com/
- GitHub Releases: https://github.com/timescale/timescaledb/releases
- Windows 설치 가이드: https://docs.timescale.com/self-hosted/latest/install/installation-windows/
