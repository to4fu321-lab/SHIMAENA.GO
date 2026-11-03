# 提案: 面白さ・新しい発想・誰でも参加・広がり（11/3）

> 企画役（kikaku）の提案メモ。仕様（`docs/spec.md`）とコードは変えていません。採用するかは本人が決めます。
> 前提: 今日 11/3、締切 11/8 20:00。残り5日。鍵は Neon 接続済み、LINE・Claude API はこれから。デモは実機3台で3分。

## 0. 先に結論（おすすめ上位3つ）
（調査のあとで書く）

## 1. 審査員目線で、いまの弱いところ
（調査のあとで書く）

## 2. 案（12個）
各案: 一言／どう遊ぶか／なぜ効くか／デモのどこで見せるか／Claude の使いどころ／実装の重さ／約束ごととの衝突

### 面白さ
（調査のあとで書く）

### 新しい発想
（調査のあとで書く）

### 誰でもカンタンに参加
（調査のあとで書く）

### 広がる力
（調査のあとで書く）

## 3. おすすめ上位3つの理由と、spec のどこを変える提案になるか
（調査のあとで書く）

## 4. 参考にした事例と出典URL
（調べた順に追記。まだ整理前）

### 雪かきマッチング・ボランティアの既存事例
- Snow Bell（北海道のベンチャー、2020年発表）: 除雪を頼みたい人と収入を得たい人をつなぐ有償マッチング。写真で評価、急ぎは「クイックベル」で近くの作業者全員に通知。 https://ascii.jp/elem/000/004/012/4012106/
- 米国の自治体「Snow Angels」型: トレド（2025、降雪5cm以上で24時間以内に除雪、市サイトで登録） https://spectrumnews1.com/oh/columbus/news/2025/09/29/toledo-snow-angels-program ／モリーン（2025、16歳以上・自宅から1マイル以内を割り当て） https://www.kwqc.com/2025/11/20/moline-seeks-volunteers-snow-angels-program-help-seniors-physically-limited-residents ／ピッツバーグ（311 電話かフォーム） https://cbsnews.com/pittsburgh/news/city-of-pittsburgh-community-volunteers-2023-24-snow-angels-program ／アナーバー「A2 Snow Match」（2024-25、住民同士をペアに） https://www.a2gov.org/news/posts/a2-snow-match-program-pairs-volunteers-with-neighbors-in-need/ ／ボルチモア「Snow Corps」（311 アプリから申込） https://baltimorefishbowl.com/stories/baltimore-launches-volunteer-program-to-help-neighbors-clear-snow/
  - 共通点: 「登録 → 1対1でペア → 24時間以内」。チーム・地図・ゲーム性・当日の点呼はどこにもない。ここがシマエナGO の差。
- 国際スポーツ雪かき選手権（小樽、2014〜、2026年で13回目。4人1組、早さと芸術性）: https://www.hokkaido-np.co.jp/article/1275842/ ／ https://www.hokkaido-np.co.jp/movies/detail/5293476807001/
  - 年1回のイベント。「毎朝」「自宅の前」にするのがシマエナGO。

### 子ども・学生・観光客が雪かきに参加した事例
- 岩手県滝沢市「伊手スノーバスターズ」: 小中学生が高齢者宅を除雪し、雪だるまづくり（「雪だるま大作戦」）。同市「川前SSB」は全員大学生。 https://www.mlit.go.jp/common/001088023.pdf
- 北海道美流渡地区: 外国人留学生の除雪ボランティアツアー（雪かき体験＋餅つき、25人）→ 若者や子どもの参加が広がった。 https://www.mlit.go.jp/common/001129967.pdf
- 札幌市広報（2013/12）: 大学生の福祉除雪参加、小学生の「砂まきボランティア」。 https://www.city.sapporo.jp/somu/koho-shi/201312/documents/20131205.pdf
- 越後雪かき道場（長岡）: 除雪の技術・事故防止・雪のない地域との交流。命綱の普及も。 https://www.mlit.go.jp/common/001128659.pdf
- 青森県弘前市 学生ボランティア「雪かたづけ隊」。 https://www.mlit.go.jp/common/001037932.pdf

### 札幌の福祉除雪
- 札幌市 福祉除雪: 高齢・障がいのある方の「道路に面した出入口から玄関先まで」を地域の協力員が除雪。社協が実施、市が補助。 https://www.city.sapporo.jp/fukushijosetsu/documents/05r6bunkakaishiryou1_02.pdf
- 令和6年度 福祉除雪 利用者アンケート概要: https://www.city.sapporo.jp/fukushijosetsu/jisseki/documents/anketogaiyor6.pdf

### 地域ゲーミフィケーション・位置情報ゲーム
- まちのコイン（カヤック）: 換金できないコミュニティ通貨。QR を読んでコインを得て、ごみ拾いやパトロール参加にも使われる。 https://media.moneyforward.com/articles/4184 ／相模原市の資料 https://www.city.sagamihara.kanagawa.jp/_res/projects/default_project/_page_/001/028/082/0315/03.pdf
- テクテクライフ: 「街区」を通ると塗れる。網走市の観光スタンプラリーと連携。 https://news.denfaminicogamer.jp/news/210708j
- ピクトレ（東京電力が参画）: 電柱の写真を撮って「制圧」、インフラ管理と地域活性を同時に。 https://www.itmedia.co.jp/news/article/2403/12/1240312062/2
- ポケモンGO と自治体: 周遊マップ、モンスターボール柄のごみ袋。 https://iphone-mania.jp/news-156874/
- まちあるきアプリの研究（歩数・滞在でポイント、スタンプが動機づけ）: https://ipsj.ixsq.nii.ac.jp/record/181793/files/IPSJ-Z79-4ZD-06.pdf

### 高齢者と LINE
- モビルス調査（2025/9）: 60代以上の LINE 利用率は 2020年 57.9% → 2025年 69.0%。 https://netshop.impress.co.jp/node/14765
- 総務省 情報通信白書 令和7年版（年代別 SNS 利用）: https://www.soumu.go.jp/johotsusintokei/whitepaper/ja/r07/html/nd111120.html
