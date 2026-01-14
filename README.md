# Fuyu's Blog

Next.js 16 を使った、Markdown ベースのブログシステムです。

## 特徴

- 📝 **GitHub ベースのコンテンツ管理**: ビルド時にコンテンツ用リポジトリを取得
- ⚡ **Next.js 16 + TurboPack**: 高速なビルドと開発体験
- 🎨 **Tailwind CSS v4**: モダンなデザインシステム
- 💾 **効率的なキャッシュ戦略**: Cache Components による 1 時間 TTL のキャッシュ
- 🚀 **静的サイト生成**: public/unlisted をビルド時に事前レンダリング

## 実装状況

### ✅ 実装済み機能

- **コアシステム**
  - ✅ Next.js 16 App Router によるルーティング
  - ✅ ビルド時に Markdown コンテンツを取得
  - ✅ Zod による Frontmatter スキーマバリデーション
  - ✅ Markdown レンダリング（react-markdown + remark-gfm）

- **キャッシュ機能**
  - ✅ Cache Components（`"use cache"`）による記事一覧のキャッシュ
  - ✅ 個別記事のキャッシュ（slug 別 cache tag）
  - ✅ 1 時間 TTL のキャッシュライフサイクル
  - ✅ キャッシュタグの付与（一覧・個別）
  - ✅ Date 型の自動復元機能

- **記事管理**
  - ✅ 記事一覧表示（公開記事のみ）
  - ✅ 個別記事ページ
  - ✅ `access` による公開/非公開制御
  - ✅ 記事の日付順ソート（`date`）
  - ✅ 静的サイト生成（public/unlisted）
  - ✅ Frontmatter による記事メタデータ管理

- **エラーハンドリング**
  - ✅ コンテンツ取得エラーの詳細ログ出力
  - ✅ 404 ページ対応
  - ✅ レイヤー別バリデーションエラー処理
    - 記事一覧: エラー記事をスキップ（他の記事は正常表示）
    - 個別記事: エラー時は 404 ページを表示

- **UI/UX**
  - ✅ レスポンシブデザイン
  - ✅ ダークモード対応
  - ✅ 記事説明文表示対応
- **アクセス制御**
  - ✅ `access: "unlisted"` による直リンク限定公開（静的生成対象）
  - ✅ `access: "protected"` によるパスワード保護（動的ゲートで本文取得）

### 🚧 未実装機能（将来の拡張予定）

- **記事機能**
  - ⏳ タグ/トピックによる記事フィルタリング
  - ⏳ 記事検索機能
  - ⏳ 関連記事の推薦
  - ⏳ 目次（Table of Contents）自動生成

- **パフォーマンス**
  - ⏳ 画像最適化（next/image 統合）
  - ⏳ OGP 画像の自動生成

- **分析・管理**
  - ⏳ Google Analytics 統合
  - ⏳ RSS フィード生成
  - ⏳ サイトマップ自動生成
  - ⏳ Webhook による自動キャッシュ無効化

- **その他**
  - ⏳ コメント機能
  - ⏳ いいね/リアクション機能
  - ⏳ 記事のシェア機能

## 技術スタック

- **フレームワーク**: Next.js 16.1.1 (App Router)
- **ランタイム**: React 19.2.3
- **言語**: TypeScript (strict mode)
- **スタイリング**: Tailwind CSS v4
- **Markdown 処理**: react-markdown + remark-gfm
- **バリデーション**: Zod

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/fuyu28/my-blog
cd my-blog
```

### 2. 依存関係のインストール

```bash
bun install
```

### 3. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定します：

```bash
# コンテンツを配置するディレクトリ（デフォルト: content-repo）
CONTENT_DIR=content-repo
```

### 4. コンテンツリポジトリの準備

ブログ記事用のリポジトリに`external-posts/<slug>/index.md`の構成で Markdown を配置します。

### 5. コンテンツリポジトリの取得（ビルド時）

ビルド前にコンテンツリポジトリを `content-repo/` に取得します。Cloudflare Pages ならビルドコマンドに以下を追加するイメージです。

```bash
git clone https://github.com/your_user/your_content_repo content-repo
bun run build
```

#### プライベートリポジトリ（Deploy Key）

コンテンツがプライベートの場合は Deploy Key を使うのが最もシンプルです。コンテンツ側リポジトリに **read-only** の Deploy Key を追加し、Cloudflare Pages の環境変数に秘密鍵を登録します。

- Cloudflare Pages 環境変数: `SSH_PRIVATE_KEY`（秘密鍵の内容）
- 取得コマンド例:

```bash
mkdir -p ~/.ssh
printf "%s" "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan github.com >> ~/.ssh/known_hosts

git clone git@github.com:your_user/your_content_repo content-repo
bun run build
```

#### コンテンツ更新で Cloudflare Pages を再ビルドする

コンテンツ側リポジトリで GitHub Actions から Cloudflare Pages の Build Hook を叩くと、更新のたびに再ビルドできます。Cloudflare Pages で Build Hook URL を発行し、コンテンツリポジトリの Secrets に `CF_PAGES_BUILD_HOOK_URL` を登録してください。

`.github/workflows/notify-pages.yml` の例:

```yaml
name: Notify Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cloudflare Pages build hook
        run: curl -X POST "$CF_PAGES_BUILD_HOOK_URL"
        env:
          CF_PAGES_BUILD_HOOK_URL: ${{ secrets.CF_PAGES_BUILD_HOOK_URL }}
```

#### Markdown ファイルの例

```md
---
title: "初めての記事"
access: "public"
description: "これはサンプル記事です"
date: "2025-01-01"
topics: ["Next.js", "React"]
---

# 見出し

本文をここに書きます。
```

#### Frontmatter フィールドの詳細

すべての Markdown ファイルは YAML 形式の Frontmatter でメタデータを定義します。Zod スキーマによる厳密なバリデーションが行われます。

##### 必須フィールド

| フィールド | 型       | 説明           | 例                      |
| ---------- | -------- | -------------- | ----------------------- |
| `title`    | `string` | 記事のタイトル | `"Next.js 16 の新機能"` |

##### オプションフィールド（デフォルト値あり）

| フィールド | 型                                                   | デフォルト値 | 説明                                                                    | 例         |
| ---------- | ---------------------------------------------------- | ------------ | ----------------------------------------------------------------------- | ---------- |
| `access`   | `"public" \| "unlisted" \| "private" \| "protected"` | `"private"`  | アクセス制限。`"unlisted"`は直リンクのみ、`"protected"`はパスワード保護 | `"public"` |

##### オプションフィールド（任意）

| フィールド    | 型                  | 説明                                                   | 例                                             |
| ------------- | ------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `thumbnail`   | `string`            | サムネイル画像の URL                                   | `"https://example.com/image.png"`              |
| `date`        | `string` (ISO 8601) | 記事の日付                                             | `"2025-01-05"` または `"2025-01-05T10:00:00Z"` |
| `description` | `string`            | 記事の要約・説明文                                     | `"Next.js 16の新機能を解説します"`             |
| `topics`      | `string[]`          | 記事に関連するトピック・タグ                           | `["Next.js", "React", "TypeScript"]`           |
| `password`    | `string`            | `access: "protected"` のとき必須となる閲覧用パスワード | `"my-article-pass"`                            |

##### 完全な例

```md
---
title: "Next.js 16 の Cache Components を使ってみた"
access: "public"
thumbnail: "https://example.com/nextjs-cache.png"
date: "2025-01-05"
description: "Next.js 16 で導入された Cache Components の使い方と実装例を紹介します。"
topics: ["Next.js", "React", "キャッシュ戦略"]
---

# Cache Components の基本

ここから本文が始まります...
```

##### バリデーションエラーについて

- 必須フィールドが欠けている場合、ビルド時にエラーが発生します
- `access` の値は列挙型で定義されているため、指定外の値は使用できません
- `date` は ISO 8601 形式（`YYYY-MM-DD` または `YYYY-MM-DDTHH:mm:ssZ`）で記述してください
- **配列形式エラー**: `topics` は配列形式で記述してください（例: `["Next.js", "React"]`）

### アクセス制御の挙動

- `access: "public"`: 一覧・静的生成の対象。従来どおり閲覧可能。
- `access: "unlisted"`: 一覧には出ないが静的生成の対象。URL を知っていれば閲覧可能。
- `access: "protected"`: 一覧と静的生成には含まれない。Frontmatter の
  `password` でパスワード認証し、認証は 12 時間クッキーで保持。

## 開発コマンド

```bash
# 開発サーバーの起動（TurboPack使用）
bun run dev

# プロダクションビルド
bun run build

# プロダクションサーバーの起動
bun run start

# リンターの実行
bun run lint
```

開発サーバーは <http://localhost:3000> で起動します。

## プロジェクト構造

```
my-blog/
├── src/
│   ├── app/                    # App Router
│   │   ├── page.tsx           # トップページ（記事一覧）
│   │   ├── post/[slug]/       # 個別記事ページ
│   │   └── layout.tsx         # ルートレイアウト
│   ├── components/            # Reactコンポーネント
│   │   └── Footer.tsx        # フッター（Client Component）
│   ├── lib/
│   │   └── content/          # コンテンツ処理
│   │       ├── posts.ts      # 記事取得API（キャッシュあり）
│   │       ├── parsePost.ts  # Markdownパース
│   │       └── frontmatterSchema.ts  # Zodスキーマ
│   └── env.d.ts              # 環境変数の型定義
├── CLAUDE.md                  # Claude Code向けドキュメント
└── README.md                  # このファイル
```

## キャッシュ戦略

このブログは**Next.js 16 の Cache Components**を使用した効率的なキャッシュを実装しています。

### キャッシュの仕組み

- **データレイヤーでのみキャッシュ**: `src/lib/content/posts.ts`の関数にキャッシュロジックを集約
- **キャッシュ期間**: 1 時間（`cacheLife("hours")`）
- **キャッシュタグ**:
  - `"posts"`: すべての記事（一覧取得）
  - `"post-{slug}"`: 個別記事（例: `"post-hello-world"`）

### キャッシュの無効化

記事を更新した場合、以下のコマンドでキャッシュを無効化できます：

```typescript
// すべての記事のキャッシュを無効化
revalidateTag("posts");

// 特定の記事のみ無効化
revalidateTag("post-hello-world");
```

### Date 型の取り扱い

キャッシュされたデータでは、Date 型は文字列として保存されます。`restoreDates()`関数が自動的に Date オブジェクトに復元します。

## デプロイ

### Vercel へのデプロイ（推奨）

1. [Vercel](https://vercel.com)にログイン
2. リポジトリをインポート
3. 環境変数を設定（`.env.local`の内容をコピー）
4. デプロイ

### その他のプラットフォーム

Next.js 16 をサポートする任意のプラットフォームにデプロイできます：

- Netlify
- Cloudflare Pages
- AWS Amplify
- 自前の Node.js サーバー

## トラブルシューティング

### ビルドエラー: "Cannot find module"

```
Error: Cannot find module '@/lib/...'
```

→ `tsconfig.json`の`paths`設定を確認してください。`@/*`が`./src/*`にマッピングされている必要があります。

### 記事が表示されない

1. `access: "public"`が設定されているか確認
2. コンテンツリポジトリが `external-posts/` に取得されているか確認
3. `CONTENT_DIR` を変更した場合はディレクトリ名が一致しているか確認

### Frontmatter のバリデーションエラー

#### 記事一覧でエラー記事が表示されない

開発サーバーのログに以下のような警告が表示される場合：

```
⚠️  記事をスキップしました: content-repo/external-posts/example/index.md
   理由: Invalid frontmatter
⚠️  1件の記事がバリデーションエラーによりスキップされました
```

→ **動作**: エラー記事は一覧から除外されますが、他の正常な記事は表示されます

→ **対処**: ログに表示されたファイルの Frontmatter を確認してください：

- **必須フィールドの不足**: `title` は必ず指定する必要があります
- **不正な enum 値**: `access` は `"public"`, `"unlisted"`, `"private"`, `"protected"` のいずれかである必要があります
- **日付形式エラー**: `date` は ISO 8601 形式（`2025-01-05` または `2025-01-05T10:00:00Z`）で記述してください
- **配列形式エラー**: `topics` は配列形式で記述してください（例: `["Next.js", "React"]`）
- **null 値エラー**: オプションフィールドは空白のままにせず、完全に省略するか、値を指定してください

#### 個別記事で 404 ページが表示される

特定の記事にアクセスした際に 404 ページが表示され、ログに以下が出力される場合：

```
Failed to fetch post: example
  error: Invalid frontmatter: ...
```

→ **動作**: バリデーションエラーがある記事は 404 ページを表示します

→ **対処**: 上記のバリデーションルールに従って Frontmatter を修正してください

## ライセンス

このプロジェクトは [MIT ライセンス](LICENSE) の下で公開されています。
