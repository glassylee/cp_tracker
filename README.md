# CP 기록 관리 (트레일러닝 대회)

Next.js + Tailwind CSS + Supabase 기반 트레일러닝 대회 체크포인트(CP) 기록 관리 웹입니다.

## 기능

- **대회(Project) 관리**: 대회 생성, CP 추가
- **CP 기록 입력**: 물자 수량, 온·습도, 특이사항, 영상 업로드
- **실시간 대시보드**: 전체 CP 기록 현황 조회
- **CSV 다운로드**: 기록 데이터 일괄 추출

## 설정

1. 의존성 설치  
   `npm install`

2. Supabase 프로젝트 생성 후 `.env.local`에 다음 추가:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Supabase SQL 에디터에서 `supabase/schema.sql` 내용 실행해 테이블 생성.

4. Supabase Storage에서 버킷 `cp-videos` 생성 (Public), 업로드 정책 설정.

5. 개발 서버 실행  
   `npm run dev`  
   → http://localhost:3000

## 페이지 구조

| 경로 | 설명 |
|------|------|
| `/` | 홈 (대회 목록·대시보드 링크) |
| `/projects` | 대회 목록 |
| `/projects/new` | 대회 추가 |
| `/projects/[id]` | 대회 상세·CP 목록 및 기록 입력 링크 |
| `/projects/[id]/checkpoints/new` | CP 추가 |
| `/projects/[id]/record?cp=[checkpointId]` | CP 기록 입력 폼 |
| `/dashboard` | 실시간 대시보드·CSV 다운로드 |

## DB 스키마 요약

- **projects**: 대회 (name, description, event_date)
- **checkpoints**: 대회별 CP (project_id, name, code, sort_order)
- **cp_records**: CP별 기록 (물자 수량, 온도, 습도, notes, video_url)
