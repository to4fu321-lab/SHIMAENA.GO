// ティザーHTMLを1コマずつ画像にして、ffmpeg で MP4 にまとめる
// 使い方: node scripts/render-teaser.cjs [出力先.mp4]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const FPS = 30, DUR = 20;
const html = path.resolve(__dirname, '../docs/video/teaser.html');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../docs/video/teaser.mp4'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teaser-'));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + html + '?t=0');   // ?t= 付きは自動再生しない
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const n = FPS * DUR;
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => seek(t), Math.min(i / FPS, DUR - 0.01));
    await p.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png') });
    if (i % 60 === 0) console.log(`${i}/${n}`);
  }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%04d.png'),
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-c:a', 'aac', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('できた:', out);
})();
