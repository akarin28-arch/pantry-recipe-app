# 🍳 うちの食材で何つくる？

家にある食材から、買い物なしで作れるレシピ・ちょい足しで作れるレシピを瞬時に提案するWebアプリ。

## アーキテクチャ

```
src/
├── app/
│   ├── layout.tsx          # Root layout (metadata, font)
│   ├── page.tsx            # メイン画面 (use client)
│   ├── globals.css         # Tailwind + custom styles
│   └── api/events/route.ts # Analytics fallback endpoint
├── lib/
│   ├── types.ts            # 型定義（PantryItem, Recipe, RankedRecipe...）
│   ├── recipes.ts          # レシピDB（20品、自作テンプレート）
│   ├── ranking.ts          # ランキングエンジン
│   ├── storage.ts          # localStorage永続化
│   └── analytics.ts        # PostHog / fallback イベント送信
```

## セットアップ

```bash
# 1. 依存インストール
npm install

# 2. 開発サーバー起動
npm run dev

# 3. http://localhost:3000 で確認
```

## Vercelデプロイ

```bash
# 1. GitHubにpush
git init && git add . && git commit -m "initial"
gh repo create pantry-app --public --push

# 2. Vercel にログイン
npx vercel login

# 3. デプロイ（自動でNext.jsを検出）
npx vercel --prod

# もしくは vercel.com でGitHubリポジトリを接続 → 自動デプロイ
```

### PostHog設定（任意）

```bash
# .env.local を作成
echo "NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxx" > .env.local
```

PostHogアカウント作成: https://posthog.com (無料枠: 月1万イベント)

未設定の場合は `/api/events` にフォールバックしてstdoutにログ出力。

## ランキングアルゴリズム

各レシピに対して:

1. **スケーリング**: `required = base_amount × (servings / baseServings) × mealCount`
2. **不足計算**: 在庫と比較し `missingItems[]` を算出
3. **ソート優先順位**:
   - `missing_items`（不足品目数）最小
   - `missing_amount`（不足量合計）最小
   - `use_up_score`（期限が近い食材の消費量）最大
   - `time`（調理時間）短い順

**買い物なし**: `missing_items = 0` のみ → Top 3
**買い足し**: `missing_items <= 上限` のみ → Top 3

## データモデル

```typescript
PantryItem {
  id: string
  name: string
  amount: number
  unit: string       // g | ml | 個 | 本 | ...
  category: string   // meat | vegetable | dairy | grain | other
  expiry?: string    // YYYY-MM-DD
}

Recipe {
  id, name, description
  mealType: string[]     // breakfast | lunch | dinner
  time: number           // minutes
  difficulty: string
  baseServings: number
  ingredients: { name, amount, unit, category }[]
  seasonings: string[]   // 常備調味料（マッチング対象外）
  steps: string[]
}
```

将来DB化する場合: `PantryItem` → pantry table, `Recipe` → recipes table, `CookEvent` → cook_history table

## Analytics Events

| イベント | タイミング | プロパティ |
|---------|----------|----------|
| `generate_viewed` | おすすめ表示 | homeCount, shopCount, peopleCount, mealType |
| `recipe_opened` | カード展開 | recipe, missing_items_count |
| `cooked_clicked` | 作った！ | recipe |
| `shopping_list_copied` | メモコピー | missing_items_count |
| `pantry_edited` | 食材追加/編集/削除 | action |
| `mode_switched` | タブ切替 | to |

全イベントに自動付与: `deviceType`, `returningUser`

## 手動テストケース

### (a) 在庫だけでTop3が出る

1. サンプル食材を投入（鶏もも肉300g、玉ねぎ3個、にんじん2本、じゃがいも4個、卵6個、米5合など）
2. 「今日のおすすめ」タブを確認
3. **期待**: 「買い物なしで作れるレシピ」に3件表示される（例: チキンカレー、親子丼、野菜炒め）

### (b) 買い足し上限1でTop3と不足が出る

1. 上記在庫の状態で「ちょい足しレシピ」の上限を「1品」に設定
2. **期待**: 在庫にない食材が1品だけ不足するレシピが表示される
3. **期待**: 各レシピカードに「🛒 買い足しアイテム」が表示される
4. **期待**: 「📋 買い物メモ」セクションが表示され、コピーボタンが動作する

### (c) 人数/食数変更で必要量がスケールし、不足が変わる

1. 人数を「2人」、食数を「1食」に設定 → 買い物なし3件を確認
2. 人数を「4人」に変更
3. **期待**: 必要量が2倍になり、在庫不足で買い物なしの件数が減る
4. 食数を「3食」に変更
5. **期待**: 必要量がさらに増え、買い物なしの件数が0件 or 1件になる

## 次の5つの改善案

1. **レシピ拡充（100本+）**: カテゴリ別（和洋中・エスニック）、季節別に拡充。ユーザーからのレシピ投稿機能も
2. **AI アレンジ提案**: レシピカードに「アレンジ提案」ボタン → AIが代替食材やアレンジ案を1-2個提案（オプション）
3. **お気に入り＆履歴**: お気に入り登録、作った履歴の閲覧、「最近作ったので除外」フィルタ
4. **バーコードスキャン / レシート読取**: カメラでバーコードや買い物レシートを読み取り、在庫を自動追加
5. **献立プランナー**: 1週間分の献立を自動提案し、まとめ買いリストを生成
