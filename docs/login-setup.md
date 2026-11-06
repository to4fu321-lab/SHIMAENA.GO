# ログインと通知の設定（本人がする作業・10分）

spec v1.17 から、LINE は **ログイン（本人の確認）だけ** に使います。公式アカウント・友だち追加・Messaging API・LIFF・リッチメニューは使いません。
点呼やお知らせはアプリの「隊長トーク」と、スマホの通知（Web Push）で届きます。

## 1. LINE ログインの鍵（LINE Developers）
1. https://developers.line.biz/console/ を開き、シマエナGO の **LINE ログイン チャネル**（LIFF があったほう）を選ぶ
2. 「チャネル基本設定」の **チャネル ID** と **チャネルシークレット** を控える
3. 「LINE ログイン設定」→ **コールバック URL** に `https://shimaena-go.vercel.app/api/auth/line/callback` を入れて保存
   - 手元で試すときは `http://localhost:3000/api/auth/line/callback` も足す
4. チャネルが「開発中」なら「公開」にする（profile と openid のスコープだけなので審査は要らない）
5. Vercel の環境変数に入れる
   - `LINE_LOGIN_CHANNEL_ID` = チャネル ID
   - `LINE_LOGIN_CHANNEL_SECRET` = チャネルシークレット
   - `AUTH_SECRET` = 長いでたらめな文字（ログインの印・合言葉・招待の印の署名に使う。`openssl rand -base64 32` などで作る）

これで、どの「はじめる」も `/login` → LINE の許可画面 → 戻ってきて登録、の流れになります。

## 2. スマホの通知の鍵（Web Push）
1. 手元で `npx web-push generate-vapid-keys` を1回だけ実行する
2. Vercel の環境変数に入れる
   - `VAPID_PUBLIC_KEY` と `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = Public Key（同じ値）
   - `VAPID_PRIVATE_KEY` = Private Key
   - `VAPID_SUBJECT` = `mailto:` から始まる連絡先（任意。なければ公開 URL）

鍵がない間は、通知は届かず隊長トークにたまるだけです（動きは止まりません）。

## 3. 使わなくなった環境変数（消してよい）
`LINE_CHANNEL_SECRET`（AUTH_SECRET を入れるまでは署名の予備として残してもよい）・`LINE_CHANNEL_ACCESS_TOKEN`・`NEXT_PUBLIC_LIFF_ID`・`NEXT_PUBLIC_LINE_ADD_FRIEND_URL`・`NEXT_PUBLIC_LINE_BOT_ID`・`LINE_DRY_RUN`・`SUPPORTER_LINE_USER_IDS`（サポーターへの連絡は、その人の LINE のアカウント ID を入れれば隊長トークに届く）

## 4. 確かめる
- スマホのブラウザで公開 URL を開き「はじめる」→「LINE でログイン」→ 許可 → 30秒の登録 → ソロ出動の画面になる
- 下のタブ「隊長」に、登録したときの文面（チーム発表など）が並ぶ
- /admin/settings の「状態」タブで、LINE ログインと通知が「設定済み」になっている
