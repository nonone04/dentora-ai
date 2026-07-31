#!/usr/bin/env node
/**
 * Regenerates every marketing screenshot in public/screenshots/ from the
 * real, running application -- never hand-made mockups.
 *
 * What it does:
 *   1. Reuses an already-running server on :3000 if one is up, otherwise
 *      runs `next build` and boots `next start` itself. Deliberately a
 *      production build, not `next dev`: dev mode's Turbopack streaming
 *      has a reproducible bug in this Next.js version where the earliest
 *      Suspense boundary on the dashboard (ClinicStats) sometimes resolves
 *      its Supabase session as unauthenticated and silently renders zeros
 *      -- confirmed gone under `next build && next start`. Production mode
 *      also means no dev route indicator to hide and faster, more
 *      consistent renders -- closer to what a real visitor sees anyway.
 *   2. Signs in through the real /demo flow (the same "Launch demo" button
 *      a visitor would click) and resets the shared demo clinic so every
 *      capture reflects freshly-dated data instead of a stale prior run.
 *   3. Visits every product page, hides the demo-only banner, waits for
 *      real data to render, and captures a retina screenshot.
 *   4. Crops each capture to the aspect ratio ProductFrame renders at
 *      (1568x762) and writes an optimized .webp into public/screenshots/.
 *
 * Usage: npm run generate:screenshots
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// This Next.js version's dev server refuses to run a second instance
// against the same project directory even on a different port, so we always
// target the default :3000 -- reusing one that's already up if present.
const PORT = process.env.SCREENSHOT_PORT ?? "3000";
const BASE_URL = `http://localhost:${PORT}`;
const OUT_DIR = path.resolve(process.cwd(), "public/screenshots");

// Matches the hardcoded width={1568} height={762} on the desktop <Image> in
// components/marketing/product-frame.tsx -- ProductFrame has no object-fit
// override there, so a source at any other aspect ratio renders stretched.
const FRAME_ASPECT = 1568 / 762;
const VIEWPORT = { width: 1568, height: 900 };
const DEVICE_SCALE_FACTOR = 2;

const STYLE_OVERRIDES = `
  [data-demo-banner] { display: none !important; }
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    scroll-behavior: auto !important;
  }
`;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: "inherit", env: process.env });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`))));
  });
}

function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.status < 500) return resolve();
      } catch {
        // server not up yet
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for ${url}`));
      }
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

/** Navigates, strips the demo banner + all CSS animation/transition delay, and waits for the page to actually settle. */
async function gotoClean(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: STYLE_OVERRIDES });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

/** Screenshots the current viewport and crops it to FRAME_ASPECT, extracting from the top so the sidebar + page header always stay in frame. */
async function captureCrop(page, filename, { scrollY } = {}) {
  if (scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(300);
  }

  const pngBuffer = await page.screenshot({ type: "png" });
  const meta = await sharp(pngBuffer).metadata();
  const width = meta.width;
  const height = Math.min(meta.height, Math.round(width / FRAME_ASPECT));

  await sharp(pngBuffer)
    .extract({ left: 0, top: 0, width, height })
    .webp({ quality: 84 })
    .toFile(path.join(OUT_DIR, filename));

  console.log(`  ✓ ${filename}`);
}

async function isServerUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let server = null;
  const alreadyRunning = await isServerUp(BASE_URL);

  if (alreadyRunning) {
    console.log(`Reusing the server already running on :${PORT}.`);
  } else {
    console.log("Building production bundle (next build)...");
    await run("npx", ["next", "build"]);

    console.log(`\nStarting production server on :${PORT}...`);
    server = spawn("npx", ["next", "start", "-p", PORT], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    // Only kill a server we spawned ourselves -- never tear down one that
    // was already running before this script started.
    server?.kill("SIGTERM");
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(1);
  });

  try {
    await waitForServer(BASE_URL);
    console.log("Server ready.\n");

    // Prefer Playwright's own bundled Chromium (`npx playwright install
    // chromium`); fall back to the system-installed Chrome channel if that
    // bundle isn't available -- e.g. Playwright's Chromium build dropping
    // support for an older OS version that Chrome itself still runs on.
    const browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      colorScheme: "light",
      // components/dashboard/count-up.tsx animates stat tiles from 0 up to
      // their real value on mount, skipping straight to the final number
      // when reduced motion is preferred -- without this every capture races
      // that animation and risks landing on a mid-count, near-zero frame.
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    console.log("Signing in via the demo flow...");
    await page.goto(`${BASE_URL}/demo`, { waitUntil: "networkidle" });
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/clinic\/[0-9a-f-]+/, { timeout: 30_000 });

    const clinicId = new URL(page.url()).pathname.match(/\/clinic\/([0-9a-f-]+)/)?.[1];
    if (!clinicId) throw new Error("Could not determine clinic id after demo sign-in.");
    console.log(`Signed in. clinicId=${clinicId}\n`);

    // First-run product tour only ever shows once per profile -- dismiss it
    // if present so it doesn't get baked into a screenshot.
    const tourDialog = page.getByRole("dialog", { name: /.+/ }).first();
    if (await tourDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tourDialog.getByRole("button").first().click();
      await page.waitForTimeout(300);
    }

    console.log("Resetting demo data to a fresh, current-dated seed...");
    await page.locator('[data-testid="demo-reset-trigger"]').click();
    const confirmDialog = page.getByRole("dialog").last();
    // DialogContent renders an icon-only "Close" button after the footer, so
    // it's last in DOM order -- the real confirm button is the *second*
    // button (index 1: Cancel, Reset demo data, Close).
    await confirmDialog.getByRole("button").nth(1).click();
    // Reset runs a delete+reseed server action; wait for its own success
    // message rather than guessing a fixed delay.
    await page.getByText("Demo data reset").first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);

    const base = `${BASE_URL}/clinic/${clinicId}`;
    console.log("\nCapturing screenshots...");

    await gotoClean(page, base);
    await captureCrop(page, "dashboard-overview.webp");
    await captureCrop(page, "analytics.webp", { scrollY: VIEWPORT.height });

    await gotoClean(page, `${base}/calendar`);
    await captureCrop(page, "calendar.webp");

    await gotoClean(page, `${base}/appointments`);
    await captureCrop(page, "appointments.webp");

    await gotoClean(page, `${base}/patients`);
    await captureCrop(page, "patients.webp");
    const patientHref = await page.locator('a[href*="/patients/"]').first().getAttribute("href");
    if (patientHref) {
      await gotoClean(page, `${BASE_URL}${patientHref}`);
      await captureCrop(page, "patient-detail.webp");
    }

    await gotoClean(page, `${base}/ai-inbox`);
    await captureCrop(page, "ai-receptionist.webp");

    await gotoClean(page, `${base}/knowledge-base`);
    await captureCrop(page, "knowledge-base.webp");

    await gotoClean(page, `${base}/staff`);
    await captureCrop(page, "staff.webp");

    await gotoClean(page, `${base}/settings`);
    await captureCrop(page, "settings.webp");

    await browser.close();
    console.log(`\nDone. Screenshots written to ${OUT_DIR}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
