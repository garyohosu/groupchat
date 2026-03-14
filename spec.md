# Genspark AI Developer用 仕様書

## プロジェクト名

Quoraのできるかなラボ グループチャット

---

## 1. 目的

Quora の「できるかなラボ」参加者向けに、LINE風の見た目で気軽に会話できるグループチャットを作成する。
ユーザーは ID とパスワードで登録・ログインできる。
チャットはブラウザで利用でき、無料枠でデプロイ可能な構成とする。

---

## 2. 開発方針

- フルスタックWebアプリとして構築する
- フロントエンドとバックエンドを同一プロジェクトで管理する
- 無料枠でデプロイできる構成を優先する
- MVP（最小実用版）としてまずは「1つのグループチャットルーム」に絞る
- UI は LINE 風の見た目にする
- DB を使用する
- 認証は ID + PASSWORD 方式（httpOnly Cookie + DBセッション）
- 運用コストを極力かけない

---

## 3. 想定技術スタック

### 必須

| 項目 | 技術 |
|------|------|
| フロントエンド | HTML / CSS / Vanilla JavaScript |
| バックエンド | Hono |
| 実行環境 | Cloudflare Pages + Pages Functions または Cloudflare Workers |
| データベース | Cloudflare D1（SQLite系） |
| セッション管理 | httpOnly Cookie + DBセッション（sessions テーブル） |
| パスワードハッシュ | Web Crypto API（PBKDF2-SHA-256） |

### 推奨

- UI: モバイル優先のレスポンシブデザイン
- バリデーション: サーバー側・クライアント側の両方で実施
- 将来拡張を考慮して API は REST で整理

### パスワードハッシュ仕様

| パラメータ | 値 |
|-----------|-----|
| アルゴリズム | PBKDF2-SHA-256 |
| salt | 16 bytes（ユーザーごとにランダム生成） |
| iterations | 310,000 |
| hash length | 32 bytes |

> Cloudflare の無料系構成では、Pages で静的フロントを配信し、Functions / Workers でAPI処理を受け、D1 をDBとして使う構成が取りやすい。Pages は全プランで利用可能、Workers Free は 1日 100,000 リクエスト、D1 は Workers Free で無料試作用途をサポートしている。

---

## 4. システム概要

### 4.1 利用者

- 一般ユーザー
- 管理者

### 4.2 MVPで実現すること

- 新規登録
- ログイン / ログアウト
- グループチャット閲覧
- グループチャット投稿
- 自分の投稿の削除
- ユーザー一覧表示
- 簡易プロフィール表示
- 管理者による不適切投稿削除

### MVPスコープ外

- 既読機能
- 音声通話・画像投稿
- 複数ルーム（ルームは1つだけ、複数ルームは将来拡張）

### 4.3 将来拡張

- 複数ルーム
- DM
- 画像投稿
- 通知
- 既読
- 通報
- 管理画面強化

---

## 5. 画面要件

### 5.1 画面一覧

| 画面名 | 説明 |
|--------|------|
| トップ / ログイン画面 | 未ログイン時の入り口 |
| 新規登録画面 | アカウント作成 |
| チャット画面 | メインのグループチャット |
| プロフィール画面 | 自分のプロフィール確認・編集 |
| 管理者用簡易管理画面 | 投稿・ユーザー管理 |

---

## 6. UI要件

### 6.1 デザイン方針

- LINE風の見た目
- スマホで見やすい縦長レイアウト
- PCでも中央カラム表示で崩れない
- 配色は明るめ、緑系を基調にしてLINE風の印象を出す
- ただし商標をそのまま模倣せず、あくまで「雰囲気が似ている」UIにする

### 6.2 チャット画面のUI

#### 上部固定ヘッダー

- ルーム名
- 登録メンバー数（登録ユーザー総数を表示）
- ログアウトボタン

#### 中央スクロール領域

- メッセージ一覧
- 自分の投稿は右寄せ
- 他人の投稿は左寄せ
- 他人の投稿にはユーザー名表示
- 各投稿に投稿時刻表示

#### 下部固定入力エリア

- テキスト入力欄
- 送信ボタン

#### 動作

- 新着メッセージ時は自動スクロール
- 長文は折り返し表示
- 1投稿の最大文字数は 500 文字

### 6.3 レスポンシブ要件

- 幅 390px 程度のスマホでも快適
- PC では中央にチャット領域を寄せる
- 画面下部の入力欄は常に見えること

---

## 7. 機能要件

### 7.1 ユーザー登録

#### 入力項目

- ログインID
- 表示名
- パスワード
- パスワード確認

#### 制約

| 項目 | 制約 |
|------|------|
| ログインID | `^[a-zA-Z0-9_.-]{3,20}$`（半角英数字・アンダースコア・ハイフン・ドットのみ、重複禁止） |
| 表示名 | 1〜20文字 |
| パスワード | 8〜128文字 |
| パスワード保存 | PBKDF2-SHA-256 でハッシュ化必須 |

#### 登録成功時

- 自動ログインしてチャット画面へ遷移

### 7.2 ログイン

#### 入力項目

- ログインID
- パスワード

#### 動作

- 認証成功でセッションを発行し httpOnly Cookie をセット
- セッション有効期限は 7日間
- 認証失敗時はエラーメッセージ表示
- `is_active=0` のユーザーはログイン不可。エラーメッセージ:「このアカウントは利用停止中です」

### 7.3 ログアウト

- セッションを即時失効（DBのsessionsレコード削除）
- Cookie を削除
- ログイン画面へ戻る

### 7.4 グループチャット表示

- メッセージを古い順で表示
- 初回表示は直近 50 件（`before` なし）
- 過去ログ読み込みボタンでさらに取得可能（`before=<messageId>` を使用）
- 投稿者名、本文、時刻を表示
- 自分の投稿のみ削除ボタンを表示
- ポーリング（3〜5秒間隔）で変更分を取得（`GET /api/messages/changes?roomId=1&since=<timestamp>` を使用）

### 7.5 メッセージ送信

#### 入力

- テキスト本文

#### 制約

| 項目 | 制約 |
|------|------|
| 空文字 | 禁止 |
| 文字数 | 1〜500文字 |
| 連投制限 | 2秒に1回まで |

#### 成功時

- DB保存
- 画面に即時反映
- 入力欄クリア

#### 補足

- リアルタイム性は必須ではない
- 3〜5秒ごとの自動ポーリングで新規投稿・削除更新を取得
- 可能なら軽量な擬似リアルタイム更新を実装

### 7.6 メッセージ削除

- 一般ユーザー: 自分の投稿のみ削除可能
- 管理者: 全投稿削除可能
- 削除時は論理削除: `is_deleted=1` にセットし、`body=''`（空文字）に更新
- 削除後の表示は「このメッセージは削除されました」固定
- 他クライアントへの削除反映は `updated_at` ベースの変更取得APIで行う

### 7.7 プロフィール

#### 表示項目

- 表示名
- ログインID
- 自己紹介（任意、最大 160文字）
- 登録日

#### 編集項目

- 表示名
- 自己紹介

### 7.8 管理者機能

- ユーザー一覧表示
- 投稿一覧表示
- 不適切投稿削除
- ユーザー停止フラグ設定（停止時は既存セッションをすべて削除）

---

## 8. DB設計

DBは Cloudflare D1 を想定する。D1 は SQLite系で扱いやすく、無料試作に向いている。

### 8.1 users テーブル

| カラム名 | 型 | 制約 |
|----------|-----|------|
| id | integer | primary key autoincrement |
| login_id | text | unique not null |
| display_name | text | not null |
| password_hash | text | not null（PBKDF2ハッシュ） |
| password_salt | text | not null（16バイト、Base64） |
| bio | text | nullable |
| role | text | not null default 'user' |
| is_active | integer | not null default 1 |
| created_at | datetime | not null |
| updated_at | datetime | not null |

### 8.2 messages テーブル

| カラム名 | 型 | 制約 |
|----------|-----|------|
| id | integer | primary key autoincrement |
| user_id | integer | not null references users(id) |
| room_id | integer | not null references rooms(id) |
| body | text | not null |
| is_deleted | integer | not null default 0 |
| created_at | datetime | not null |
| updated_at | datetime | not null |

### 8.3 rooms テーブル

| カラム名 | 型 | 制約 |
|----------|-----|------|
| id | integer | primary key autoincrement |
| name | text | not null |
| description | text | nullable |
| created_at | datetime | not null |

### 8.4 sessions テーブル

| カラム名 | 型 | 制約 |
|----------|-----|------|
| id | integer | primary key autoincrement |
| user_id | integer | not null references users(id) |
| session_token | text | unique not null |
| expires_at | datetime | not null（発行から7日） |
| created_at | datetime | not null |

### 初期データ

```sql
-- ルーム作成
INSERT INTO rooms (id, name, description, created_at)
VALUES (1, 'Quoraのできるかなラボ', 'できるかなラボ用グループチャット', CURRENT_TIMESTAMP);

-- 管理者ユーザー作成
-- password_hash / password_salt は初回デプロイ時に環境変数 ADMIN_PASSWORD から生成してINSERT
-- 初回ログイン後にパスワード変更を推奨
INSERT INTO users (login_id, display_name, password_hash, password_salt, role, is_active, created_at, updated_at)
VALUES ('admin', '管理者', '<PBKDF2_HASH>', '<SALT>', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

---

## 9. API仕様

### 9.1 認証系

#### 共通エラーレスポンス

```json
{
  "success": false,
  "error": {
    "code": "LOGIN_ID_ALREADY_EXISTS",
    "message": "このログインIDは既に使用されています"
  }
}
```

**ステータス方針:**

- `400 Bad Request`: 入力不正、必須不足、形式不正
- `401 Unauthorized`: 未ログイン、認証失敗、期限切れセッション
- `403 Forbidden`: 権限不足、停止ユーザー
- `404 Not Found`: 対象データなし
- `409 Conflict`: `loginId` 重複など競合
- `429 Too Many Requests`: 連投制限、ログイン試行過多
- `500 Internal Server Error`: 想定外エラー

**代表的な `error.code`:**

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `SESSION_EXPIRED`
- `FORBIDDEN`
- `ACCOUNT_DISABLED`
- `NOT_FOUND`
- `LOGIN_ID_ALREADY_EXISTS`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

#### `POST /api/auth/register` — 新規登録

**Request:**

```json
{
  "loginId": "string",
  "displayName": "string",
  "password": "string",
  "passwordConfirm": "string"
}
```

**Response:**

```json
{
  "success": true,
  "user": { "id": 1, "loginId": "...", "displayName": "..." }
}
```

成功時は `Set-Cookie` ヘッダーでセッションCookieをセット。

---

#### `POST /api/auth/login` — ログイン

**Request:**

```json
{
  "loginId": "string",
  "password": "string"
}
```

**Response:**

```json
{
  "success": true,
  "user": { "id": 1, "loginId": "...", "displayName": "...", "role": "user" }
}
```

成功時は `Set-Cookie` ヘッダーでセッションCookieをセット（httpOnly, Secure, SameSite=Lax, Max-Age=604800）。

---

#### `POST /api/auth/logout` — ログアウト

セッションをDBから削除しCookieを無効化。

**Response:** `{ "success": true }`

期限切れセッションは認証チェック時に `expires_at > now` を満たさない場合、その場で削除して `401 Unauthorized` を返す。

---

### 9.2 ユーザー系

#### `GET /api/me` — ログイン中ユーザー情報取得

**Response:**

```json
{
  "id": 1,
  "loginId": "...",
  "displayName": "...",
  "bio": "...",
  "role": "user",
  "createdAt": "2026-03-14T12:00:00Z"
}
```

---

#### `PUT /api/me` — プロフィール更新

**Request:**

```json
{
  "displayName": "string",
  "bio": "string"
}
```

---

#### `GET /api/users` — ユーザー一覧（一般ユーザー向け）

ログイン済みユーザーが利用可能。

**Response:**

```json
{
  "users": [
    {
      "id": 1,
      "displayName": "hantani",
      "bio": "自己紹介テキスト",
      "createdAt": "2026-03-14T12:00:00Z"
    }
  ]
}
```

非表示項目: `loginId`, `role`, `isActive`

---

### 9.3 メッセージ系

#### `GET /api/messages` — メッセージ一覧取得

**クエリパラメータ:**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| roomId | 必須 | 対象ルームID |
| before | 任意 | このID未満のメッセージを取得（過去ログ遡り用） |

- 最大50件を返す
- 初回表示は `before` なしで直近50件

**Response:**

```json
{
  "messages": [
    {
      "id": 101,
      "userId": 2,
      "displayName": "hantani",
      "body": "こんにちは",
      "isDeleted": false,
      "createdAt": "2026-03-14T12:00:00Z",
      "updatedAt": "2026-03-14T12:00:00Z"
    }
  ],
  "hasMore": true
}
```

- `hasMore`: 過去ログ取得時にさらに古いメッセージが存在するかどうか
- `isDeleted=true` の場合、`body` は空文字。クライアント側で「このメッセージは削除されました」と表示する

---

#### `GET /api/messages/changes` — メッセージ変更分取得

新着ポーリング用。新規投稿と更新済み投稿（削除を含む）を返す。

**クエリパラメータ:**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| roomId | 必須 | 対象ルームID |
| since | 必須 | この時刻より後に `updated_at` されたメッセージを取得 |

**Response:**

```json
{
  "messages": [
    {
      "id": 101,
      "userId": 2,
      "displayName": "hantani",
      "body": "",
      "isDeleted": true,
      "createdAt": "2026-03-14T12:00:00Z",
      "updatedAt": "2026-03-14T12:05:00Z"
    }
  ]
}
```

---

#### `POST /api/messages` — メッセージ投稿

**Request:**

```json
{
  "roomId": 1,
  "body": "string"
}
```

---

#### `DELETE /api/messages/:id` — メッセージ削除

- 一般ユーザーは自分の投稿のみ
- 管理者は全投稿可能
- 処理: `is_deleted=1` にセットし `body=''` に更新（論理削除）

---

### 9.4 管理者系

#### `GET /api/admin/users` — ユーザー一覧取得

role=admin のみ許可。

---

#### `PATCH /api/admin/users/:id/status` — ユーザー有効/無効切り替え

role=admin のみ許可。

**Request:**

```json
{
  "isActive": 0
}
```

停止処理時（`isActive=0`）は、該当ユーザーの sessions レコードをすべて削除する。

---

#### `DELETE /api/admin/messages/:id` — 任意メッセージ削除

role=admin のみ許可。処理は `DELETE /api/messages/:id` と同じ（論理削除）。

---

## 10. バリデーション要件

| フィールド | ルール |
|-----------|--------|
| loginId | `^[a-zA-Z0-9_.-]{3,20}$` |
| displayName | 1〜20文字 |
| password | 8〜128文字 |
| bio | 160文字以内 |
| body | 1〜500文字 |

バリデーションはサーバー側・クライアント側の両方で実施する。

---

## 11. セキュリティ要件

- パスワードは PBKDF2-SHA-256 でハッシュ化保存（salt はユーザーごとにランダム生成）
- SQLインジェクション対策（プリペアドステートメント使用）
- XSS対策として投稿本文はエスケープ表示
- 認証Cookieは `HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
- 状態変更系API（POST/PUT/PATCH/DELETE）では `Origin` ヘッダーを検証してCSRF対策
- 認証時は `expires_at > now` を必須条件とし、期限切れセッションは検出時に削除する
- 管理者APIは `role=admin` のみ許可
- 同一IPからの過剰送信を簡易制限
- 連続ログイン試行を簡易制限

---

## 12. 非機能要件

### パフォーマンス

- 初期表示 3秒以内
- チャット投稿後 1秒以内に画面反映

### スケール

- 小規模利用を前提
- 同時接続: 数十人程度
- 投稿数: 1日 数百件程度

### 可用性・UX

- 障害時も最低限トップ画面が表示されること
- エラー時はユーザー向けに分かりやすいメッセージを表示

> Workers Free の日次リクエスト上限はあるので、最初から重い常時接続より、まずはポーリング式で作って様子を見るのが安全。静的アセット配信は無料でさばきやすく、動的処理だけを Worker 側に寄せると無料枠運用しやすい。

---

## 13. デプロイ要件

- Cloudflare Pages / Workers の無料枠へデプロイ
- カスタムドメインは任意
- 環境変数で秘密情報を管理（管理者初期パスワードを含む）
- 本番DBと開発DBは分離可能な設計
- 初回デプロイ後に D1 のマイグレーションを実行
- マイグレーション時に初期データ（ルーム・管理者ユーザー）を投入

> Cloudflare Pages は全プランで利用でき、Pages の無料プランでは 20,000 ファイルまでの制限がある。今回のような小規模チャットアプリなら十分収まりやすい。

---

## 14. 実装優先順位

### Phase 1

- ユーザー登録
- ログイン
- 1ルーム固定チャット
- メッセージ投稿
- メッセージ表示
- ログアウト

### Phase 2

- プロフィール編集
- 自分の投稿削除
- 管理者削除
- 過去ログ読み込み（`before` パラメータ）

### Phase 3

- 連投制限強化
- ユーザー停止
- UX改善
- 擬似リアルタイム改善（ポーリング最適化）

---

## 15. 完成条件

以下をすべて満たしたら完成とする。

- [ ] 新規ユーザー登録ができる
- [ ] ログインできる
- [ ] グループチャットに投稿できる
- [ ] 投稿が他ユーザーから見える
- [ ] LINE風UIでスマホ表示が見やすい
- [ ] 無料枠環境にデプロイできる
- [ ] DBにユーザーとメッセージが保存される
- [ ] 最低限の管理者機能がある
