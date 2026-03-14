# Quoraのできるかなラボ - グループチャット

LINE風の見た目で気軽に会話できるグループチャットアプリケーションです。Cloudflare Pages + Hono + D1で構築されています。

## 📱 機能

### ✅ 実装済み機能

- **ユーザー登録・ログイン**
  - PBKDF2-SHA-256による安全なパスワードハッシュ（310,000 iterations）
  - httpOnly Cookieによるセッション管理（7日間有効）
  
- **グループチャット**
  - リアルタイム風のメッセージ表示（3秒ごとのポーリング）
  - 最大500文字のメッセージ送信
  - 自分のメッセージの削除（論理削除）
  - 過去ログの読み込み
  - LINE風のUI（自分のメッセージは右寄せ、他人は左寄せ）
  
- **プロフィール管理**
  - 表示名の変更
  - 自己紹介の編集（最大160文字）
  
- **管理者機能**
  - ユーザー一覧表示
  - 任意のメッセージ削除
  - ユーザーアカウントの有効/無効切り替え

### 🚧 今後の拡張予定

- 複数ルーム対応
- ダイレクトメッセージ
- 画像投稿
- 通知機能
- 既読機能

## 🏗️ 技術スタック

- **フロントエンド**: HTML / CSS / Vanilla JavaScript
- **バックエンド**: Hono (TypeScript)
- **データベース**: Cloudflare D1 (SQLite)
- **デプロイ先**: Cloudflare Pages
- **認証**: httpOnly Cookie + DBセッション
- **パスワードハッシュ**: PBKDF2-SHA-256

## 📊 データベース構造

### テーブル一覧

- **users**: ユーザー情報
- **messages**: メッセージ
- **rooms**: ルーム情報
- **sessions**: セッション管理

詳細は `migrations/0001_initial_schema.sql` を参照してください。

## 🚀 ローカル開発

### 前提条件

- Node.js 18以降
- npm

### セットアップ

```bash
# 依存関係のインストール
npm install

# D1データベースのマイグレーション（ローカル）
npm run db:migrate:local

# シードデータの投入
npm run db:seed

# 管理者アカウントの初期化
curl -X POST http://localhost:3000/api/init-admin

# ビルド
npm run build

# PM2で開発サーバー起動
pm2 start ecosystem.config.cjs

# または直接起動
npm run dev:d1
```

### 管理者アカウント

初期管理者アカウント:
- **ログインID**: `admin`
- **パスワード**: `Admin@12345`

⚠️ **本番環境では必ずパスワードを変更してください！**

### 便利なコマンド

```bash
# ローカルDBのリセット
npm run db:reset

# ローカルDBコンソール
npm run db:console:local

# PM2のログ確認
pm2 logs quora-chat --nostream

# PM2の再起動
pm2 restart quora-chat
```

## 📦 Cloudflare Pagesへのデプロイ

### 1. Cloudflare D1データベースの作成

```bash
# 本番用データベース作成
npx wrangler d1 create quora-chat-db

# 出力されたdatabase_idをwrangler.jsonc に設定
# "database_id": "your-database-id-here"
```

### 2. マイグレーション実行

```bash
# 本番DBへマイグレーション
npm run db:migrate:prod

# シードデータ投入
npx wrangler d1 execute quora-chat-db --file=./seed.sql
```

### 3. 管理者アカウント作成

デプロイ後、以下のAPIを一度だけ呼び出します:

```bash
curl -X POST https://your-app.pages.dev/api/init-admin
```

### 4. Cloudflare Pagesプロジェクト作成

```bash
# プロジェクト作成
npx wrangler pages project create quora-dekirukana-chat \
  --production-branch main \
  --compatibility-date 2024-01-01

# デプロイ
npm run deploy:prod
```

### 環境変数（必要に応じて）

本番環境で環境変数が必要な場合:

```bash
npx wrangler pages secret put SECRET_NAME --project-name quora-dekirukana-chat
```

## 📝 API仕様

### 認証API

- `POST /api/auth/register` - 新規登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト

### ユーザーAPI

- `GET /api/me` - 現在のユーザー情報取得
- `PUT /api/me` - プロフィール更新
- `GET /api/users` - ユーザー一覧取得

### メッセージAPI

- `GET /api/messages` - メッセージ一覧取得
- `GET /api/messages/changes` - 変更分取得（ポーリング用）
- `POST /api/messages` - メッセージ送信
- `DELETE /api/messages/:id` - メッセージ削除

### 管理者API

- `GET /api/admin/users` - 全ユーザー一覧
- `PATCH /api/admin/users/:id/status` - ユーザー有効/無効切り替え
- `DELETE /api/admin/messages/:id` - 任意のメッセージ削除

詳細は `spec.md` を参照してください。

## 🔒 セキュリティ機能

- PBKDF2-SHA-256パスワードハッシュ（310,000 iterations）
- httpOnly, Secure, SameSite=Lax Cookie
- CSRF保護（Originヘッダー検証）
- SQLインジェクション対策（プリペアドステートメント）
- XSS対策（エスケープ処理）
- セッション期限管理（7日間）
- 連投制限（2秒に1回）

## 📱 UIデザイン

- LINE風の緑基調デザイン
- スマホ優先（390px〜対応）
- 自分の投稿は右寄せ、他人の投稿は左寄せ
- 上部固定ヘッダー + 中央スクロール領域 + 下部固定入力欄

## 🧪 テスト

ローカル環境で動作確認:

```bash
# サーバー起動後
curl http://localhost:3000

# 新規登録テスト
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"loginId":"testuser","displayName":"テストユーザー","password":"testpass123","passwordConfirm":"testpass123"}'

# ログインテスト
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"testuser","password":"testpass123"}'
```

## 📄 ライセンス

MIT

## 👥 開発者

Quoraのできるかなラボ参加者向けに開発

## 🐛 バグ報告・機能要望

GitHubのIssuesまでお願いします。

## 📚 参考資料

- [Hono Documentation](https://hono.dev/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [プロジェクト仕様書](./spec.md)
- [Q&A](./QandA.md)
