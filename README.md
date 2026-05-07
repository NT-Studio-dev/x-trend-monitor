# X Trend Monitor

日本語の動画ツイートを毎日自動収集し、ランキング形式でダッシュボード表示するツール

![Daily Fetch](https://github.com/NT-Studio-dev/x-trend-monitor/actions/workflows/daily.yml/badge.svg)

## 概要

X (Twitter) 上の日本語動画ツイートを毎日自動で収集し、以下の3指標でランキングを生成します。

- **再生数** (Views)
- **ブックマーク数** (Bookmarks)
- **エンゲージメントスコア** (複合指標)

集計期間は **デイリー / ウィークリー / マンスリー** の3種類。GitHub Actions で毎日自動実行され、GitHub Pages 上のダッシュボードで閲覧できます。

## 技術スタック

| 技術 | 用途 |
|------|------|
| Node.js 20 | データ取得・集計処理 |
| TwitterAPI.io | ツイート検索 API |
| GitHub Actions | 定時自動実行 (毎日 03:00 JST) |
| GitHub Pages | ダッシュボードホスティング |
| Tailwind CSS (CDN) | ダッシュボードUI |

## セットアップ手順

1. [TwitterAPI.io](https://twitterapi.io/) でアカウント作成し、API キーを取得
2. リポジトリをクローン
   ```bash
   git clone https://github.com/NT-Studio-dev/x-trend-monitor.git
   cd x-trend-monitor
   ```
3. GitHub リポジトリの Settings > Secrets に `TWITTERAPI_KEY` を登録
4. Settings > Pages で Source を `main` ブランチ / `/docs` フォルダに設定
5. 依存パッケージをインストール
   ```bash
   npm install
   ```

## ローカル実行

```bash
cp .env.example .env
# .env に API キーを設定
npm install
node src/index.js
# docs/index.html をブラウザで開く
```

## ディレクトリ構成

```
x-trend-monitor/
├── .github/workflows/
│   └── daily.yml          # GitHub Actions ワークフロー
├── src/
│   ├── index.js           # エントリポイント
│   ├── fetch.js           # ツイート取得
│   ├── render.js          # ダッシュボード用 JSON 生成
│   ├── rollup.js          # 集計処理
│   └── lib/
│       ├── api.js         # API クライアント
│       ├── score.js       # スコア計算
│       └── timewindow.js  # 期間判定
├── data/
│   ├── daily/             # 日次データ (JSON)
│   ├── weekly/            # 週次集計
│   └── monthly/           # 月次集計
├── docs/
│   ├── index.html         # ダッシュボード
│   └── assets/            # CSS / JS
└── package.json
```

## データ構造

- `data/daily/YYYY-MM-DD.json` — その日に取得した動画ツイート一覧
- `data/weekly/` / `data/monthly/` — 各期間の集計ランキング
- `docs/data.json` — ダッシュボード表示用の統合データ

### エンゲージメントスコア

```
score = views + (likes x 2) + (retweets x 3) + (bookmarks x 5) + (replies x 1)
```

各アクションの重みづけにより、単純な再生数だけでなく質の高いエンゲージメントを評価します。

## GitHub Actions

- **実行時刻**: 毎日 03:00 JST (18:00 UTC)
- **手動実行**: Actions タブから `workflow_dispatch` で手動トリガー可能
- **自動コミット**: `data/` と `docs/data.json` を自動コミット・プッシュ

## トラブルシューティング

| 問題 | 原因・対処 |
|------|-----------|
| API エラー (401/403) | `TWITTERAPI_KEY` が未設定または無効。Secrets を確認 |
| 結果が空 | API クレジット残高を確認。検索クエリの条件を見直す |
| Pages が更新されない | Settings > Pages のソース設定を確認。デプロイに数分かかる場合あり |
| コミットが作成されない | データに変更がない場合はスキップされる (正常動作) |

## コスト目安

- TwitterAPI.io: 月額約 **$2.25** (約340円)
- 初回チャージ $10 で約4ヶ月運用可能

## ライセンス

MIT
