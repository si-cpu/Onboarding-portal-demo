// 백업 시연 영상(deck/output/*.mp4) 재녹화용 스크립트. playwright는 이 프로젝트의
// 정식 의존성이 아니라 재생성 시에만 필요하다 — 실행 전 `npm install -D playwright`.
// 실행: node deck/record_demo.mjs
// 녹화 후: ffmpeg -y -i deck/video-raw/*.webm -c:v libx264 -pix_fmt yuv420p -crf 20
//          -preset medium -movflags +faststart deck/output/InterX_온보딩포털_시연영상.mp4
import { chromium } from "playwright";

const BASE = "https://onboarding-portal-e2c22.vercel.app";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: "deck/video-raw", size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

// 1. 로그인
await page.goto(BASE + "/login", { waitUntil: "load" });
await page.waitForSelector('input[type="email"]');
await wait(1000);
await page.fill('input[type="email"]', "intern@test.local");
await page.fill('input[type="password"]', "RoleTest1234!");
await page.click('button:has-text("로그인")');
await page.waitForURL(/\/intern\/home/, { timeout: 20000 });
await wait(500);

// 2. 홈 화면
await wait(7000);

// 3. 핵심가치 둘러보기
await page.click('text=핵심가치 둘러보기');
await page.waitForSelector(".value-grid");
await wait(5500);
await page.mouse.wheel(0, 400);
await wait(3000);

// 4. 미션 화면 (내 답변 + AI 피드백)
await page.click('a.tab:has-text("미션")');
await page.waitForTimeout(1500);
await wait(7000);

// 5. 도움 요청
await page.click('text=도움 요청');
await page.waitForSelector("textarea");
await wait(800);
await page.fill("textarea", "이번 주 업무 도구 접근 권한이 아직 없어서 확인 부탁드려요.");
await wait(800);
await page.click('button:has-text("인사팀에게 보내기")');
await wait(3500);

// 6. 로그아웃 → HR 로그인
await page.click('button:has-text("로그아웃")');
await page.waitForURL(/\/login/, { timeout: 15000 });
await wait(500);
await page.fill('input[type="email"]', "hr@test.local");
await page.fill('input[type="password"]', "RoleTest1234!");
await page.click('button:has-text("로그인")');
await page.waitForURL(/\/hr/, { timeout: 15000 });
await wait(1000);

// 7. HR 대시보드 — 미답변 요청 패널
await wait(7000);

// 8. 요청함 이동 후 답장
await page.click('text=요청함 보기');
await page.waitForSelector("textarea", { timeout: 10000 });
await wait(1000);
await page.fill("textarea", "네, 오늘 중으로 접근 권한 처리해드릴게요!");
await wait(800);
await page.click('button:has-text("답장 보내기")');
await wait(3000);

// 9. 다시 대시보드로 — 패널이 사라진 것 확인
await page.click('text=인사팀 뷰');
await page.waitForTimeout(1000);
await wait(4000);

await context.close();
await browser.close();
console.log("recording done");
