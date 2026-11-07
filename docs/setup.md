# 公開版の準備と運用（Vercel・Neon・LINE ログイン・通知・Cron）

README から運用の手順を切り出したもの。鍵はすべて Vercel の環境変数に入れ、リポジトリには書かない。

## 1. ローカルで動かす
```bash
npm install
npm run dev
```
`.env.local` に `ANTHROPIC_API_KEY` などを置く（リポジトリには含めない）。
鍵がない間は、Claude はモック応答、保存はメモリで動く。確かめ方は `npm run check`（lint・型・テスト・build）。

## 2. データベース（Neon）
1. Vercel の環境変数に `DATABASE_URL`（Neon）を入れる。
2. `/admin` を開き「DB を準備する」を押す（表を作り、架空の町内データを入れる。何度押しても安全）。
3. 「保存: Neon（参加者 12 人）」と出れば完了。以後、地図とデモ操作の状態は Neon に保存される。
4. 表が増えたとき（`db/schema.sql` が変わったとき）は、`/admin` にまた黄色い枠が出るので、もう一度押す。

## 3. 管理画面と運用の設定
- `ADMIN_PASSWORD`: `/admin`（デモ操作）を開く合言葉。**公開版では入れるまで誰も操作できない。**
- `DEMO_MODE=off`: 本当に町内で使うとき。`?as=h3` のような架空の人として押すことと、「見本の状態に戻す」ができなくなる（既定はオン＝審査・撮影用）。
- `/admin/settings` の「通知を一時停止」で、端末への通知だけを止められる（隊長トークには残る）。
- `/admin` には、保存や通知の失敗が赤い「問題」として出る。「声」タブに今週の声と改善の提案が出る。
- 人手が足りない家の最後の連絡先（町内会役員役のサポーター）: `SUPPORTER_LINE_USER_IDS`（LINE のアカウント ID をカンマ区切り）。
- カードの絵を描くモデルを上げたいとき: `CARD_ART_MODEL`（既定は Claude Opus 5.5）。
- 隊長の声（spec v1.33、隊長トークの日本語の読み上げ）: 既定でオン（無料の VOICEVOX Web API、鍵なし）。`CAPTAIN_VOICE=off` で切る（ブラウザの声に戻る）。`VOICEVOX_SPEAKER` で声を変える（番号は https://api.tts.quest/v3/voicevox/speakers_array の順。既定 3 = ずんだもん）。混んで断られることが増えたら、api.tts.quest で無料の鍵を作って `VOICEVOX_API_KEY` に入れる。
- ことば（spec v1.33）: 隊長トークの 🌐 で選ぶ。隊長の文の訳は `ANTHROPIC_API_KEY` があるときだけ（なければ日本語のまま）。訳は `translations` 表に貯まる（`/admin` の「DB を準備する」で作る。なくても最初に使うとき自動で作る）。
- 隊長トークで Claude を呼ぶ回数の1人1日の上限（公開中のお金の守り。架空の人 `?as=h1` などだけ。LINE でログインした人は上限なし）: `CHAT_TEXT_PER_DAY`（文。既定 20）・`CHAT_PHOTO_PER_DAY`（写真。既定 5）。超えた分は鍵がないときと同じモック応答になる。`/api/song?date=` で作れる歌は今日と過去7日だけ。

## 4. ログインと通知（spec v1.17: LINE はログインだけ）
1. [`docs/login-setup.md`](login-setup.md) のとおり、Vercel の環境変数に `LINE_LOGIN_CHANNEL_ID`・`LINE_LOGIN_CHANNEL_SECRET`・`AUTH_SECRET`（ログインの印の署名）と、`VAPID_PUBLIC_KEY`・`VAPID_PRIVATE_KEY`・`NEXT_PUBLIC_VAPID_PUBLIC_KEY`（端末への通知。`npx web-push generate-vapid-keys` で作る）を入れる。
2. 「はじめる」→「LINE でログイン」→ 許可 → 画面で30秒の登録（手伝う／手伝ってほしい／家族の代わりに → 家の場所 → 2問 → チーム。お願いする側もチームに入る）。家族は「家族の代わりに登録」→ 6桁の連携コードを本人や他の家族が「はじめる」の画面で入れて紐づける。
3. 隊長トーク（下のタブ「隊長」）の上の 🔔 で、端末への通知をオンにする（iPhone はホーム画面に追加してから）。鍵がない間は通知は届かず、隊長トークにたまるだけ。

## 5. 点呼を自動で動かす（Vercel Cron ＋ GitHub Actions）
1. Vercel の環境変数に `CRON_SECRET`（長いランダムな文字列）を入れる。ないと `/api/cron/*` は動かない。
2. `vercel.json` の cron が、前夜 21:00 JST に予告（Open-Meteo で翌朝 6:00 までの降雪が 5cm 以上のときだけ。日曜は先に「今週の群れ」）、6:30 JST に「10cm 以上積もったか」の判定と作戦の配信をする。
3. 6:40 の作戦配信の予備と 11:30・16:30 のお昼・夕方の出番は、Hobby プラン（cron は2本まで）の Vercel には置かず、**GitHub Actions**（`.github/workflows/plan.yml`・`later.yml`）から `/api/cron/plan`・`/api/cron/noon`・`/api/cron/pm` を呼ぶ。リポジトリの Settings → Secrets and variables → Actions に `APP_URL`（公開 URL）と `CRON_SECRET`（Vercel と同じ値）を入れる。
4. 同じことは `/admin` のボタンで手動でもできる（デモはこちら）。

## 6. デモ・撮影のときの流れ
- `/admin` の「0 前夜の予告」→「1 6:30 積もった」→「3 6:40 司令官の作戦」で、架空の人の隊長トークに「おはよう」と作戦が届く。「4 1軒、完了にする」「5 駆けつけ」で朝が進む。
- `/map?as=h1`・`/chat?as=r7` のように、架空の人として画面を開ける（`DEMO_MODE` がオンのとき）。
- 撮影ステージ `docs/video/stage.html` は仮想スマホ4台を並べる。台本は [`docs/demo.md`](demo.md)。
- 夜（19時〜翌 6時）は防犯のルールで、よその家の「行く」が断られる。撮影は日本時間 6〜19時に。

## 7. 確かめ方の道具
- `npm run check`: lint・型・テスト・build。
- `npm run shot -- /map?as=h3`: スマホ幅（390×844）のスクショを `.shots/` に。
- `node scripts/fit.cjs "/map?as=h3"`: 390×844 と 375×667 ではみ出しを測る（基本1画面）。
- `node scripts/sound-check.cjs`: 音の合成が鳴るかを確かめる。
- `npm run sim`: 架空の参加者20人と頼む家10軒で、雪の朝を本物の処理に通す（`.sim/report.html`）。
- `npm run tenken`: 全ページをスマホ幅で開き、はみ出し・エラー・小さい文字を数える（点検ループ。決まりは [`docs/tenken.md`](tenken.md)）。
