# QAシート — spec.md レビュー不明点

仕様書レビューで発見した確認事項・不明点をまとめる。
**全Q 回答済み・確定。spec.md に反映済み。**

---

## Q1. セッション管理方式はどちらを選ぶか？

**採用: A) Cookieベース + DBセッション**

- sessions テーブル設計と自然に一致する
- ログアウト時の無効化が簡単
- 管理者による強制失効もやりやすい
- MVPでは JWT のうまみより運用のわかりやすさが勝つ

**spec反映:** 認証方式は「httpOnly Cookie + DBセッション」に統一。JWTの記述は削除。

---

## Q2. パスワードハッシュの実装方式は？

**採用: B) Web Crypto API の PBKDF2-SHA-256**

- Cloudflare Workers で素直に動く
- Native 依存がない
- MVPなら十分現実的

**パラメータ:**
- salt: 16 bytes（ユーザーごとにランダム生成）
- iterations: 310,000
- hash length: 32 bytes

**spec反映:** 「bcrypt系または同等」→「Web Crypto API を用いた PBKDF2-SHA-256」に明記。

---

## Q3. ログインIDに使える「一部記号」はどれか？

**採用:** `^[a-zA-Z0-9_.-]{3,20}$`

- 半角英数字、アンダースコア `_`、ハイフン `-`、ドット `.` のみ

**spec反映:** バリデーション要件・ユーザー登録要件に正規表現を明記。

---

## Q4. パスワードの上限文字数は？

**採用: 8〜128文字**

- 上限なしは地味にリスクがある
- PBKDF2なのでbcryptの72バイト問題は回避できるが入力上限はあるべき

**spec反映:** `password: 8〜128文字` に更新。

---

## Q5. ヘッダーの「参加人数」は何を指すか？

**採用: A) 登録ユーザー総数**

- オンライン人数はMVPには過剰
- UI文言は「参加人数」→「登録メンバー数」に変更

**spec反映:** UI要件の文言を更新。

---

## Q6. 管理者アカウントはどうやって作成するか？

**採用: A) 初回D1マイグレーションでINSERT**

- 一番事故が少ない
- 隠しAPIは危険
- 手動更新は忘れやすい

**条件:**
- 初期パスワードは環境変数から設定
- 初回ログイン後にパスワード変更必須（ドキュメントで明示）

**spec反映:** §8 初期データに管理者ユーザー作成を追記。

---

## Q7. ポーリングで新着メッセージを取得するAPIパラメータが足りない

**採用: `after=<messageId>` を追加**

- `before` のみでは過去ログ遡りにしか使えない
- 新着取得には `after` が必須

**spec反映:**
- `GET /api/messages?roomId=1&before=<messageId>` — 過去ログ取得
- `GET /api/messages?roomId=1&after=<messageId>` — 新着取得
- 初回表示は before/after なしで直近50件

---

## Q8. 論理削除後、DBの `body` カラムはどうするか？

**採用: B) body を空にして論理削除**

- 削除の意思を尊重
- プライバシー面で安全

**spec反映:** 削除時は `is_deleted=1` にし `body=''` に更新。表示は「このメッセージは削除されました」固定。

---

## Q9. 停止ユーザー（`is_active=0`）がログインしようとしたときの挙動は？

**採用: ログイン拒否 + 既存セッション失効**

**spec反映:**
- `is_active=0` のユーザーはログイン不可
- ログイン時は「このアカウントは利用停止中です」を表示
- 停止処理時に既存セッションをすべて削除

---

## Q10. 一般ユーザー向けの「ユーザー一覧」画面・APIが未定義

**採用: 一般ユーザーも見られる。ただし最小限の情報のみ**

**追加API:** `GET /api/users`

返却項目:
- id
- displayName
- bio
- createdAt

非表示: loginId, role, isActive

**spec反映:** §9.2 に `GET /api/users` を追加。

---

## Q11. `GET /api/messages` のレスポンス形式が未定義

**採用: 以下のスキーマで確定**

```json
{
  "messages": [
    {
      "id": 101,
      "userId": 2,
      "displayName": "hantani",
      "body": "こんにちは",
      "isDeleted": false,
      "createdAt": "2026-03-14T12:00:00Z"
    }
  ],
  "hasMore": true
}
```

`hasMore` は過去ログ取得時に使用（新着取得時は不要）。

**spec反映:** §9.3 レスポンス形式を追記。

---

## Q12. CSRF対策の具体的な実装方針は？

**採用: SameSite=Lax Cookie + Origin ヘッダー検証**

- MVPとして十分現実的
- トークン方式まで不要

**spec反映:** §11 セキュリティ要件に明記。

---

## Q13. フロントエンドのフレームワークはどちらを選ぶか？

**採用: A) Vanilla JS（HTML/CSS/JavaScript）**

- AI生成でも壊れにくい
- Cloudflare Pages に載せやすい
- ビルドステップ不要
- LINE風UIもVanilla JSで十分作れる

**spec反映:** §3 技術スタックを「Vanilla JS」に確定。

---

## Q14. セッションの有効期限（TTL）は何日か？

**採用: 7日間**

- バランスがよい（長すぎず短すぎない）
- ログアウト時は即時失効
- 停止ユーザー化時も即時失効

**spec反映:** §7.2、§8.4 に明記。

---

---

## 追加レビューで確定した事項

## Q15. 論理削除したメッセージを、ポーリング中の他クライアントへどう反映するか？

**採用: A) `updated_at` ベースで更新分も再取得できる API にする**

- `after=<messageId>` だけでは削除更新が取れない
- 削除専用APIを増やすより単純
- 既存の `updated_at` を活かせる
- MVPでも他クライアントへの削除反映が自然にできる

**仕様反映:**
- 新着ポーリングは `GET /api/messages/changes?roomId=1&since=<timestamp>` を使用
- 返却対象は新規投稿と更新済み投稿（削除含む）
- `GET /api/messages` は初回表示と過去ログ取得用に整理

**関連spec:** §7.4, §7.6, §9.3

---

## Q16. プロフィール画面の「ユーザーID」は、数値IDと loginId のどちらを表示するか？

**採用: B) 表示するのは `loginId`**

- 数値 `id` は内部管理用として扱うほうが自然
- ユーザーが認識しやすいのは `loginId`
- プロフィールに出す「ID」として自然
- APIにもすでに `loginId` がある

**仕様反映:**
- プロフィール画面の表示項目は「ユーザーID」ではなく「ログインID」に変更
- 数値の `id` は内部識別子として非表示

**関連spec:** §7.7, §9.2

---

## Q17. APIエラー時のHTTPステータスとレスポンス形式を統一するか？

**採用: 統一する**

- フロント実装が楽になる
- バリデーションエラー・認証失敗・権限不足・重複IDなどの扱いを揃えられる

**共通エラーレスポンス:**

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

**関連spec:** §9

---

## Q18. sessions.expires_at の運用ルールはどうするか？

**採用: A) 認証時に `expires_at > now` を必須条件にし、期限切れ行は見つけ次第削除**

- 一番わかりやすい
- DBにゴミをためにくい
- 別途メンテジョブ必須にしなくてよい
- 無料枠運用に合う

**仕様反映:**
- Cookie から `session_token` を取得
- `sessions` を検索
- 該当なしなら `401 Unauthorized`
- `expires_at <= now` ならその行を削除して `401 Unauthorized`
- 有効なら認証成功

**期限切れ時のレスポンス例:**

```json
{
  "success": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "セッションの有効期限が切れました。再度ログインしてください"
  }
}
```

**関連spec:** §7.2, §8.4, §9.1, §11

---

*Q1-Q18 は回答済み・確定。spec.md に反映済み。*
