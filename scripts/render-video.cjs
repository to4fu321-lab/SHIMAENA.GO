// HTML アニメを1コマずつ画像にして、ffmpeg で音楽つき MP4 にまとめる（並列で速く）
// 使い方: node scripts/render-video.cjs [html] [秒] [音声] [出力.mp4]
//   既定: docs/video/demo3min.html 180 docs/video/bgm.mp3 docs/video/demo3min.mp4
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const root = path.resolve(__dirname, '..');
const html = path.resolve(process.argv[2] || path.join(root, 'docs/video/demo3min.html'));
const DUR = Number(process.argv[3] || 180);
const audio = path.resolve(process.argv[4] || path.join(root, 'docs/video/bgm.mp3'));
const out = path.resolve(process.argv[5] || path.join(root, 'docs/video/demo3min.mp4'));
const FPS = 30, WORKERS = Math.min(4, os.cpus().length), N = FPS * DUR;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vid-'));
(async () => {
  const b = await chromium.launch();
  let done = 0;
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto('file://' + html + '?render=1');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    for (let i = w; i < N; i += WORKERS) {
      await p.evaluate(t => seek(t), Math.min(i / FPS, DUR - 0.01));
      await p.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 94 });
      if (++done % 300 === 0) console.log(`${done}/${N}`);
    }
  }));
  await b.close();
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
    '-i', audio, '-t', String(DUR), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('できた:', out);
})();
