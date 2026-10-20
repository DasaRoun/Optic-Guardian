/**
 * =========================================================================
 * [경남 광선로 단선 예방 관제 보고서] Google Apps Script (GAS) 자동 발송 엔진
 * =========================================================================
 * 
 * 1. doPost(e): 웹 대시보드에서 [🚀 Google API 즉시 자동 발송] 버튼 클릭 시 백그라운드 발송
 * 2. sendDailyMorningReport(): 워킹데이(월~금 평일) 08시 30분 무인 자동 발송 스케줄러
 * 
 * [배포 방법 - 1분 완성]
 * 1) https://script.google.com 접속 -> 새 프로젝트 생성
 * 2) 본 코드 전체를 Code.gs에 붙여넣기 및 저장 (Ctrl+S)
 * 3) 우측 상단 [배포] -> [새 배포] -> 유형 선택: [웹 앱]
 *    - 설명: 관제 보고서 발송 API
 *    - 다음 사용자로 실행: 나(내 계정)
 *    - 액세스 권한이 있는 사용자: [모든 사용자 (Anyone)] -> [배포] 클릭
 * 4) 생성된 [웹 앱 URL] 복사 후 관제 대시보드 모달의 [Google API URL 설정]에 붙여넣기!
 */

// 1) 웹 대시보드 연동 즉시 발송 및 클라우드 데이터 동기화 핸들러
function doPost(e) {
  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      data = e.parameter;
    }

    // ☁️ [클라우드 DB 동기화 기능 1] 천재지변 복구 데이터 저장
    if (data && data.action === 'saveDisasterRecovery') {
      const items = Array.isArray(data.items) ? data.items : [];
      const props = PropertiesService.getScriptProperties();
      props.setProperty('DISASTER_RECOVERY_DATA', JSON.stringify(items));
      const nowStr = new Date().toISOString();
      props.setProperty('DISASTER_RECOVERY_UPDATED_AT', nowStr);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "saveDisasterRecovery",
        count: items.length,
        updatedAt: nowStr
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ☁️ [클라우드 DB 동기화 기능 2] 모의훈련 시나리오 데이터 저장
    if (data && data.action === 'saveMockTraining') {
      const items = Array.isArray(data.items) ? data.items : [];
      const props = PropertiesService.getScriptProperties();
      props.setProperty('MOCK_TRAINING_DATA', JSON.stringify(items));
      const nowStr = new Date().toISOString();
      props.setProperty('MOCK_TRAINING_UPDATED_AT', nowStr);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "saveMockTraining",
        count: items.length,
        updatedAt: nowStr
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ☁️ [클라우드 DB 동기화 기능 3] 전체 클라우드 데이터 일괄 조회
    if (data && data.action === 'getCloudData') {
      const props = PropertiesService.getScriptProperties();
      const recRaw = props.getProperty('DISASTER_RECOVERY_DATA');
      const mockRaw = props.getProperty('MOCK_TRAINING_DATA');
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        disasterRecovery: recRaw ? JSON.parse(recRaw) : null,
        disasterUpdatedAt: props.getProperty('DISASTER_RECOVERY_UPDATED_AT') || null,
        mockTraining: mockRaw ? JSON.parse(mockRaw) : null,
        mockUpdatedAt: props.getProperty('MOCK_TRAINING_UPDATED_AT') || null
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const recipient = data.recipient;
    const subject = data.subject || "[현장 관제] 경남 광선로 단선예방 및 복합 중복구간 일일 보고서";
    const body = data.body || "";

    if (!recipient) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "수신자 이메일이 누락되었습니다." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Gmail을 통해 수신자에게 백그라운드 메일 발송
    GmailApp.sendEmail(recipient, subject, body);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "메일이 성공적으로 발송되었습니다." }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET 요청 핸들러 (서버 상태 확인, 클라우드 데이터 동기화 조회 및 공공데이터 프록시)
function doGet(e) {
  // ☁️ [클라우드 DB 동기화] 모든 사용자 화면 실시간 공유 데이터 조회 (천재지변 & 모의훈련)
  if (e && e.parameter && e.parameter.action === 'getCloudData') {
    try {
      const props = PropertiesService.getScriptProperties();
      const recRaw = props.getProperty('DISASTER_RECOVERY_DATA');
      const mockRaw = props.getProperty('MOCK_TRAINING_DATA');
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        disasterRecovery: recRaw ? JSON.parse(recRaw) : null,
        disasterUpdatedAt: props.getProperty('DISASTER_RECOVERY_UPDATED_AT') || null,
        mockTraining: mockRaw ? JSON.parse(mockRaw) : null,
        mockUpdatedAt: props.getProperty('MOCK_TRAINING_UPDATED_AT') || null
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ☁️ [클라우드 DB 동기화] GET 방식 저장 폴백 (천재지변)
  if (e && e.parameter && e.parameter.action === 'saveDisasterRecovery' && e.parameter.payload) {
    try {
      const items = JSON.parse(e.parameter.payload);
      const props = PropertiesService.getScriptProperties();
      props.setProperty('DISASTER_RECOVERY_DATA', JSON.stringify(items));
      const nowStr = new Date().toISOString();
      props.setProperty('DISASTER_RECOVERY_UPDATED_AT', nowStr);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: items.length, updatedAt: nowStr }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ☁️ [클라우드 DB 동기화] GET 방식 저장 폴백 (모의훈련)
  if (e && e.parameter && e.parameter.action === 'saveMockTraining' && e.parameter.payload) {
    try {
      const items = JSON.parse(e.parameter.payload);
      const props = PropertiesService.getScriptProperties();
      props.setProperty('MOCK_TRAINING_DATA', JSON.stringify(items));
      const nowStr = new Date().toISOString();
      props.setProperty('MOCK_TRAINING_UPDATED_AT', nowStr);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: items.length, updatedAt: nowStr }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  if (e && e.parameter && e.parameter.action === 'getItsEvents') {
    try {
      const apiKey = e.parameter.apiKey || '76ba2e3c92e64c7a80f685d37cc7e9a2';
      const minX = e.parameter.minX || '127.5';
      const maxX = e.parameter.maxX || '129.2';
      const minY = e.parameter.minY || '34.6';
      const maxY = e.parameter.maxY || '35.8';
      const isNationwide = e.parameter.nationwide === 'true';
      
      let url = `https://openapi.its.go.kr:9443/eventInfo?apiKey=${apiKey}&type=all&eventType=all&getType=json`;
      if (!isNationwide) {
        url += `&minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}`;
      }
      
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      return ContentService.createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 조달청 나라장터(PPS) 수목전지·가지치기·지장수목 입찰공고 프록시
  if (e && e.parameter && e.parameter.action === 'getPpsTrimmingEvents') {
    try {
      const apiKey = e.parameter.apiKey || '07f3dd8d543ba3d1ab1ab4a7c6f03a3bd962c8459a6a88d4b18611533fbd6b9a';
      const keyword = e.parameter.keyword || '전정';
      const bgnDt = e.parameter.bgnDt || '202609170000';
      const endDt = e.parameter.endDt || '202610172359';
      const type = e.parameter.workType === 'servc' ? 'Servc' : 'Cnstwk'; // 용역 or 공사
      
      const ppsUrl = `https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfo${type}PPSSrch?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=50&pageNo=1&inqryDiv=1&inqryBgnDt=${bgnDt}&inqryEndDt=${endDt}&bidNtceNm=${encodeURIComponent(keyword)}&type=json`;
      
      const response = UrlFetchApp.fetch(ppsUrl, { muteHttpExceptions: true });
      return ContentService.createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 산림청 산사태 예측정보 프록시
  if (e && e.parameter && e.parameter.action === 'getLandslidePrediction') {
    try {
      const apiKey = e.parameter.apiKey || '07f3dd8d543ba3d1ab1ab4a7c6f03a3bd962c8459a6a88d4b18611533fbd6b9a';
      const pageNo = e.parameter.pageNo || '1';
      const numOfRows = e.parameter.numOfRows || '100';
      const url = `https://apis.data.go.kr/1400000/predictionInfoService/predictionInfoList?serviceKey=${encodeURIComponent(apiKey)}&pageNo=${pageNo}&numOfRows=${numOfRows}&_type=json`;
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      return ContentService.createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput("✅ [Google Apps Script] 경남 광선로 관제 보고서 발송 및 ITS/조달청 공공데이터 프록시 서버가 정상 작동 중입니다.");
}

// 2) 매일 아침 08:30 워킹데이(월~금 평일) 무인 자동 발송 스케줄러 함수
// (Google Apps Script 좌측 [트리거 (시계 아이콘)] -> [트리거 추가] -> 시간 기반 / 매일 오전 8시~9시 등록)
function sendDailyMorningReport() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0: 일요일, 6: 토요일

  // 주말(토, 일)은 자동 제외 (워킹데이만 발송)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    Logger.log("주말이므로 자동 발송을 건너뜁니다.");
    return;
  }

  // 발송할 담당자 이메일 주소 (여러 명일 경우 쉼표로 구분: "a@kepco.co.kr, b@telecom.com")
  const defaultRecipients = "your-email@example.com"; 

  const timeStr = Utilities.formatDate(today, "Asia/Seoul", "yyyy-MM-dd HH:mm");
  const subject = `[현장 관제 자동보고] ${timeStr} 경남 광선로 단선예방 및 복합 중복구간 일일 보고서`;

  const body = `[통신 광선로 단선 예방 현장 관제 일일 보고서]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 관제일시 : ${timeStr} 기준 | 경남 11개 시·군 (워킹데이 08:30 자동 발송)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【 🚨 1. 복합 중복구간 (광선로 + 현장공사 동시 발생 지역) - 초집중 관리 】
※ 아래 5개 지역은 광선로 바로 옆에서 굴착/전지 작업이 진행되는 '초위험 중복 현장'입니다.

  1) [진주 충무공동] ➔ 굴착 × 광선로 중복 🚨
     - [광선로] 기간통신 백본 288C 지중선로
     - [굴  착] 동진로 상수도 배관 지중 매설 ((주)경남상하수도개발)
     - [위  험] 포클레인 버킷 직접 타격 위험 ➔ 감시원 상시 입회 필수

  2) [거제 고현동] ➔ 노면절삭 × 광선로 중복 🚨
     - [광선로] 통신 3사 공동관로 144C
     - [공  사] 상가 밀집지 통신관로 신설 굴착 (한진정보통신(주))
     - [위  험] 노면 파쇄기에 의한 맨홀 파손 및 인장 단선 ➔ OTDR 원격 감시

  3) [통영 광도면] ➔ 가스배관 × 광선로 중복 🚨
     - [광선로] 죽림신도시 가입자 분기망 96C
     - [굴  착] 도시가스 본관 인입 지하 매설 (경남에너지 협력사)
     - [위  험] 가스배관 직교 굴착 시 관통 파손 위험 ➔ 포클레인 금지 / 인력 굴착

  4) [사천 사천읍] ➔ 보도터파기 × 가공광선로 중복 🚨
     - [광선로] 한전 전주 공가 가공 광케이블 72C
     - [굴  착] 사천대로 보도 정비 및 전신주 이설 (삼천포토건(주))
     - [위  험] 중장비 붐대 접촉 위험 ➔ 절연 방호관 50m 장착 / 이격(2m) 준수

  5) [하동 화개면] ➔ 수목벌채 × 가공광선로 중복 🚨
     - [광선로] 기지국 연계 가공 광케이블 48C
     - [전  지] 화개로 벚나무 가로수 지장가지 정비 (지리산전업사)
     - [위  험] 벌채 낙하 가지에 의한 장력 단선 ➔ 로프 하향 유도 / 방호망 설치

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【 ⚠️ 2. 단독 작업구간 (광선로 간섭 없는 일반 현장) - 통상 관리 】
※ 아래 5개 지역은 광선로와 겹치지 않는 일반 굴착 및 수목전지 현장입니다.

  [굴착 단독]
  - [고성 회화면] 배둔리 농로 배수로 굴착공사 (대성종합건설)

  [수목전지 단독]
  - [진주 문산읍] 문산D/L 12호 가공배전선로 가로수 전정 ((주)대창전력)
  - [사천 곤명면] 곤명D/L 34호 산간 배전선로 활선 근접 대나무 제거 (삼천포전기(주))
  - [산청 시천면] 지리산 진입로 가공선로 지장소나무 특수 전정 (경남그린전력)
  - [거제 일운면] 거제대로 해안 방풍림 해송 가지치기 (거제전설(주))
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
* 본 메일은 Google Apps Script 무료 스케줄러에 의해 워킹데이(평일) 08:30에 무인 자동 발송되었습니다.`;

  GmailApp.sendEmail(defaultRecipients, subject, body);
  Logger.log("✅ 08:30 일일 관제 보고서 무인 자동 발송 완료: " + defaultRecipients);
}
