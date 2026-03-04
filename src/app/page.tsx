"use client";

import { useState, useEffect, useMemo } from "react";
import type { PantryItem, RankedRecipe, MissingItem } from "@/lib/types";
import { recipes } from "@/lib/recipes";
import { rankRecipes, decrementPantry } from "@/lib/ranking";
import {
  loadPantry, savePantry,
  loadSettings, saveSettings,
  addCookEvent,
} from "@/lib/storage";
import { initAnalytics, track } from "@/lib/analytics";

// ── Constants ──
const CATEGORIES = [
  { id: "vegetable", label: "野菜", emoji: "🥬" },
  { id: "meat", label: "肉・魚", emoji: "🥩" },
  { id: "dairy", label: "乳製品・卵", emoji: "🥚" },
  { id: "grain", label: "米・麺・粉", emoji: "🍚" },
  { id: "seasoning", label: "調味料", emoji: "🧂" },
  { id: "preserved", label: "保存食材（缶詰・乾物など）", emoji: "🥫" },
  { id: "other", label: "その他", emoji: "🫙" },
] as const;

const TIMINGS = [
  { id: "朝のみ", label: "朝のみ" },
  { id: "昼のみ", label: "昼のみ" },
  { id: "夜のみ", label: "夕のみ" },
  { id: "朝＋昼", label: "朝＋昼" },
  { id: "昼＋夜", label: "昼＋夕" },
  { id: "朝昼夜", label: "朝昼夕" },
];

const getTimingArray = (tLabel: string): string[] => {
  if (tLabel === "朝のみ") return ["breakfast"];
  if (tLabel === "昼のみ") return ["lunch"];
  if (tLabel === "夜のみ") return ["dinner"];
  if (tLabel === "朝＋昼") return ["breakfast", "lunch"];
  if (tLabel === "昼＋夜") return ["lunch", "dinner"];
  if (tLabel === "朝昼夜") return ["breakfast", "lunch", "dinner"];
  return [];
};

const GENRES = ["すべて", "和", "洋", "中", "その他"];
const UNITS = ["g", "kg", "ml", "L", "個", "本", "枚", "束", "袋", "丁", "合", "玉", "切れ", "パック", "缶", "杯"];

const COMMON_ITEMS: Record<string, string[]> = {
  vegetable: ["玉ねぎ", "にんじん", "じゃがいも", "キャベツ", "長ねぎ", "もやし", "きゅうり", "ピーマン", "大根", "ごぼう", "れんこん"],
  meat: ["鶏もも肉", "鶏ひき肉", "豚薄切り肉", "豚ロース肉", "豚ひき肉", "合いびき肉", "ウインナー", "ハム", "鮭"],
  dairy: ["卵", "牛乳", "チーズ", "バター"],
  grain: ["米", "スパゲティ", "焼きそば麺", "パン粉", "小麦粉"],
  seasoning: ["塩", "胡椒", "醤油", "サラダ油", "ごま油", "みりん", "料理酒", "砂糖", "だし", "ケチャップ", "マヨネーズ", "ソース", "味噌", "豆板醤", "生姜", "にんにく"],
  preserved: ["カレールー", "ツナ缶", "わかめ"],
  other: ["豆腐", "こんにゃく"]
};

const SAMPLE_PANTRY: PantryItem[] = [
  { id: "s1", name: "鶏もも肉", amount: 300, unit: "g", category: "meat" },
  { id: "s2", name: "豚薄切り肉", amount: 200, unit: "g", category: "meat" },
  { id: "s3", name: "卵", amount: 6, unit: "個", category: "dairy" },
  { id: "s4", name: "玉ねぎ", amount: 3, unit: "個", category: "vegetable" },
  { id: "s5", name: "にんじん", amount: 2, unit: "本", category: "vegetable" },
  { id: "s6", name: "じゃがいも", amount: 4, unit: "個", category: "vegetable" },
  { id: "s7", name: "キャベツ", amount: 6, unit: "枚", category: "vegetable" },
  { id: "s8", name: "長ねぎ", amount: 2, unit: "本", category: "vegetable" },
  { id: "s9", name: "もやし", amount: 1, unit: "袋", category: "vegetable" },
  { id: "s10", name: "米", amount: 5, unit: "合", category: "grain" },
  { id: "s11", name: "豆腐", amount: 1, unit: "丁", category: "other" },
  { id: "s12", name: "カレールー", amount: 8, unit: "個", category: "preserved" },
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warn" }) {
  const styles = {
    default: "bg-[#f0e8d8] text-pantry-accent",
    success: "bg-pantry-success-bg text-pantry-success",
    warn: "bg-pantry-warn-bg text-pantry-warn",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap font-mincho ${styles[variant]}`}>
      {children}
    </span>
  );
}

function RecipeCard({ r, mode, onCook }: { r: RankedRecipe & { displayServings: string }; mode: string; onCook: (r: RankedRecipe) => void }) {
  const [open, setOpen] = useState(false);

  const tags: { label: string; variant: "success" | "warn" }[] = [];
  if (r.missingCount === 0) tags.push({ label: "✅ 買い物不要", variant: "success" });
  if (r.useUpScore > 3) tags.push({ label: "♻️ 食材使い切り", variant: "success" });
  if (r.time <= 15) tags.push({ label: "⚡ 時短", variant: "success" });
  if (r.missingCount > 0) tags.push({ label: `🛒 あと${r.missingCount}品`, variant: "warn" });

  return (
    <div className={`rounded-xl overflow-hidden border border-pantry-border bg-pantry-card transition-shadow ${open ? "shadow-lg" : "shadow-sm"}`}>
      <div className="p-3.5 cursor-pointer" onClick={() => { setOpen(!open); if (!open) track("recipe_opened", { recipe: r.id, missing_items_count: r.missingCount }); }}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-mincho text-[17px] font-semibold text-pantry-text mb-1">{r.name}</h3>
            <p className="text-xs text-pantry-text-light mb-1.5">{r.description}</p>
            <div className="flex gap-1 flex-wrap">
              <Badge>⏱ {r.time}分</Badge>
              <Badge>{r.difficulty}</Badge>
              {/* @ts-ignore - allow genre from recipe objects */}
              <Badge>{r.genre}</Badge>
              <Badge>{r.displayServings}</Badge>
              {tags.map((t, i) => <Badge key={i} variant={t.variant}>{t.label}</Badge>)}
            </div>
          </div>
          <span className="text-lg text-pantry-text-light mt-1">{open ? "▾" : "▸"}</span>
        </div>

        {mode === "shopping" && r.missingItems.length > 0 && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-pantry-warn-bg border border-[#f0d890]">
            <div className="text-[11px] font-bold text-pantry-warn mb-1 font-mincho">🛒 買い足しアイテム</div>
            <div className="flex gap-1 flex-wrap">
              {r.missingItems.map((m, i) => (
                <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-[#f0d890] text-[#8a6d1b]">
                  {m.name} {m.deficit}{m.unit}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 border-t border-[#efe6d4]">
          <div className="mt-3">
            <h4 className="text-[13px] font-bold text-pantry-text-mid font-mincho mb-1.5">材料（{r.displayServings}）</h4>
            {r.scaledIngredients.map((ing, i) => {
              const miss = r.missingItems.find(m => m.name === ing.name);
              return (
                <div key={i} className={`flex justify-between px-2 py-1 rounded text-[13px] font-mincho ${miss ? "bg-[rgba(184,134,11,0.06)]" : i % 2 === 0 ? "bg-[rgba(120,90,60,0.03)]" : ""}`}>
                  <span className="text-pantry-text">{miss ? "🛒 " : ""}{ing.name}</span>
                  <span className={miss ? "text-pantry-warn" : "text-pantry-text-light"}>{ing.required}{ing.unit}</span>
                </div>
              );
            })}
            {r.seasonings.length > 0 && (
              <div className="text-[11px] text-pantry-text-light mt-1 px-2">＋ 調味料: {r.seasonings.join("、")}</div>
            )}
          </div>

          <div className="mt-3.5">
            <h4 className="text-[13px] font-bold text-pantry-text-mid font-mincho mb-1.5">作り方</h4>
            {r.steps.map((step, i) => (
              <div key={i} className="flex gap-2.5 text-[13px] font-mincho text-pantry-text mb-1.5">
                <span className="shrink-0 w-[22px] h-[22px] rounded-full bg-pantry-accent text-white flex items-center justify-center text-[11px] mt-0.5">
                  {i + 1}
                </span>
                <span className="flex-1 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { onCook(r); track("cooked_clicked", { recipe: r.id }); }}
            className="mt-3 px-4 py-2 rounded-lg bg-pantry-accent text-white font-mincho text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            🍳 作った！（在庫を減らす）
          </button>
        </div>
      )}
    </div>
  );
}

function ShoppingMemo({ recipes }: { recipes: RankedRecipe[] }) {
  const allMissing: Record<string, MissingItem> = {};
  recipes.forEach(r =>
    r.missingItems.forEach(m => {
      const key = m.name + m.unit;
      if (!allMissing[key]) allMissing[key] = { ...m };
      else allMissing[key].deficit = Math.max(allMissing[key].deficit, m.deficit);
    })
  );
  const items = Object.values(allMissing);
  if (items.length === 0) return null;

  const [copied, setCopied] = useState(false);
  const text = items.map(m => `□ ${m.name} ${m.deficit}${m.unit}`).join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      track("shopping_list_copied", { missing_items_count: items.length });
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  return (
    <div className="bg-pantry-warn-bg border border-[#f0d890] rounded-xl p-3.5 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold text-pantry-warn font-mincho">📋 買い物メモ</span>
        <button onClick={copy}
          className="text-[12px] px-2.5 py-1 rounded-lg bg-pantry-warn text-white font-mincho font-semibold hover:opacity-90">
          {copied ? "✓ コピー済み" : "コピー"}
        </button>
      </div>
      {items.map((m, i) => (
        <div key={i} className="text-[13px] font-mincho text-[#6a5520] py-0.5">
          □ {m.name} — {m.deficit}{m.unit}
        </div>
      ))}
    </div>
  );
}

function PantryItemRow({ item, onUpdate, onDelete }: {
  item: PantryItem;
  onUpdate: (i: PantryItem) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ name: item.name, amount: String(item.amount), unit: item.unit, expiry: item.expiry || "" });

  const save = () => {
    if (f.name.trim()) {
      onUpdate({ ...item, name: f.name.trim(), amount: parseFloat(f.amount) || 0, unit: f.unit, expiry: f.expiry || undefined });
      track("pantry_edited", { action: "update" });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-wrap gap-1.5 p-1.5 bg-[rgba(120,90,60,0.05)] rounded-lg items-center">
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="食材名" autoFocus
          onKeyDown={e => e.key === "Enter" && save()}
          className="flex-1 min-w-[70px] px-2 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px]" />
        <input value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} type="number" placeholder="量"
          className="w-14 px-2 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px] text-center" />
        <select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}
          className="w-14 px-1 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px]">
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <input value={f.expiry} onChange={e => setF({ ...f, expiry: e.target.value })} type="date"
          className="w-[110px] px-2 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px]" />
        <button onClick={save} className="text-[12px] px-2 py-1 rounded bg-pantry-accent text-white font-mincho">保存</button>
        <button onClick={() => setEditing(false)} className="text-[12px] px-2 py-1 text-pantry-text-light">×</button>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = item.expiry && item.expiry <= today;
  const isNear = item.expiry && !isExpired && (new Date(item.expiry).getTime() - Date.now()) / 86400000 < 3;

  return (
    <div className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-[rgba(120,90,60,0.04)] group transition-colors">
      <span className="flex-1 text-[13px] font-mincho text-pantry-text">
        {item.name}
        {isExpired && <span className="text-[10px] text-red-500 ml-1">期限切れ</span>}
        {isNear && <span className="text-[10px] text-pantry-warn ml-1">もうすぐ期限</span>}
      </span>
      <span className="text-[13px] text-pantry-text-light font-mincho">{item.amount}{item.unit}</span>
      {item.expiry && <span className={`text-[10px] ${isExpired ? "text-red-500" : "text-pantry-text-light"}`}>{item.expiry.slice(5)}</span>}
      <button onClick={() => setEditing(true)}
        className="text-[11px] text-pantry-accent-light px-1 border border-pantry-accent-light rounded hover:bg-pantry-accent-light hover:text-white transition-colors">
        ✏️ 編集
      </button>
      <button onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 text-[14px] text-red-400 px-1 transition-opacity">×</button>
    </div>
  );
}

function AddItemInline({ onAdd, category }: { onAdd: (i: PantryItem) => void; category: string }) {
  const [open, setOpen] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const common = COMMON_ITEMS[category] || [];
  const [f, setF] = useState({ name: common[0] || "", amount: "", unit: "g", expiry: "" });

  const submit = () => {
    if (f.name.trim()) {
      onAdd({ id: uid(), name: f.name.trim(), amount: parseFloat(f.amount) || 1, unit: f.unit, category: category as PantryItem["category"], expiry: f.expiry || undefined });
      setF({ name: common[0] || "", amount: "", unit: "g", expiry: "" });
      setOpen(false);
      setIsManual(false);
      track("pantry_edited", { action: "add" });
    }
  };

  if (!open) return (
    <button onClick={() => { setOpen(true); setIsManual(false); }}
      className="w-full py-1 text-[12px] border-2 border-dashed border-pantry-accent-light text-pantry-text-light rounded-lg font-mincho hover:border-pantry-accent hover:text-pantry-accent transition-colors">
      ＋ 追加
    </button>
  );

  return (
    <div className="flex flex-wrap gap-1.5 p-1.5 bg-[rgba(120,90,60,0.05)] rounded-lg items-center">
      {!isManual ? (
        <select value={f.name} onChange={e => {
          if (e.target.value === "__manual__") { setIsManual(true); setF({ ...f, name: "" }); }
          else setF({ ...f, name: e.target.value });
        }}
          className="flex-1 min-w-[80px] px-1 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px]">
          {common.map(n => <option key={n} value={n}>{n}</option>)}
          <option value="__manual__">（手入力する...）</option>
        </select>
      ) : (
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="食材名" autoFocus
          onKeyDown={e => e.key === "Enter" && submit()}
          className="flex-1 min-w-[70px] px-2 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px]" />
      )}

      <input value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} type="number" placeholder="量"
        className="w-14 px-2 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px] text-center" />
      <select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}
        className="w-14 px-1 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px]">
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <input value={f.expiry} onChange={e => setF({ ...f, expiry: e.target.value })} type="date"
        className="w-[110px] px-2 py-1 rounded border border-pantry-accent-light bg-pantry-card font-mincho text-[13px]" />
      <button onClick={submit} className="text-[12px] px-2 py-1 rounded bg-pantry-accent text-white font-mincho">追加</button>
      <button onClick={() => setOpen(false)} className="text-[12px] px-2 py-1 text-pantry-text-light">×</button>
    </div>
  );
}

function QuickAddItem({ onAdd }: { onAdd: (i: PantryItem) => void }) {
  const [f, setF] = useState({ name: "", amount: "", unit: "g" });
  const submit = () => {
    if (f.name.trim() && f.amount) {
      onAdd({ id: uid(), name: f.name.trim(), amount: parseFloat(f.amount) || 1, unit: f.unit, category: "other" as any });
      setF({ name: "", amount: "", unit: "g" });
      track("pantry_edited", { action: "quick_add" });
    }
  };
  return (
    <div className="flex gap-1.5 items-center">
      <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="食材名 (例: トマト)"
        onKeyDown={e => e.key === "Enter" && submit()}
        className="flex-1 min-w-[80px] px-2 py-1.5 rounded border border-pantry-accent-light bg-pantry-bg font-mincho text-[13px]" />
      <input value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} type="number" placeholder="量"
        onKeyDown={e => e.key === "Enter" && submit()}
        className="w-14 px-2 py-1.5 rounded border border-pantry-accent-light bg-pantry-bg font-mincho text-[13px] text-center" />
      <select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}
        className="w-14 px-1 py-1.5 rounded border border-pantry-accent-light bg-pantry-bg font-mincho text-[13px]">
        {["g", "個", "本", "枚", "パック", "ml"].map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <button onClick={submit} className="px-3 py-1.5 rounded bg-pantry-accent text-white font-mincho text-[12px] font-bold whitespace-nowrap">追加</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════
export default function HomePage() {
  const [tab, setTab] = useState<"home" | "pantry">("home");
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [servings, setServings] = useState(2);
  const [timing, setTiming] = useState("朝のみ");
  const [genre, setGenre] = useState("すべて");
  const [dishCount, setDishCount] = useState(3);
  const [toast, setToast] = useState<string | null>(null);

  // App Mode (pantry = standard tracking, quick = add and search)
  // @ts-ignore
  const [appMode, setAppMode] = useState<"pantry" | "quick">("pantry");
  const [showOptions, setShowOptions] = useState(false);

  // Search States
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [homeRecipes, setHomeRecipes] = useState<RankedRecipe[]>([]);
  const [shopRecipes, setShopRecipes] = useState<RankedRecipe[]>([]);

  // Init
  useEffect(() => {
    initAnalytics();
    const saved = loadPantry();
    const settings = loadSettings();
    setPantry(saved.length > 0 ? saved : []);

    // We can merge old settings smoothly
    if (settings.servings) setServings(settings.servings);
    // @ts-ignore
    if (settings.timing && settings.timing[0]) setTiming(settings.timing[0]);
    // @ts-ignore
    if (settings.genre) setGenre(settings.genre);
    // @ts-ignore
    if (settings.dishCount !== undefined) setDishCount(settings.dishCount);
    // @ts-ignore
    if (settings.mode) setAppMode(settings.mode);
    setLoaded(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    savePantry(pantry);
    // @ts-ignore (Saving mixed old/new settings schema)
    saveSettings({ servings, timing: [timing], genre, dishCount, mode: appMode });
  }, [pantry, servings, timing, genre, dishCount, appMode, loaded]);

  const mealCount = getTimingArray(timing).length || 1;

  const performSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      const timingArr = getTimingArray(timing);
      // @ts-ignore
      const hr = rankRecipes(pantry, { servings, timing: timingArr, genre, maxMissing: 0 }).slice(0, 3);
      // @ts-ignore
      const sr = rankRecipes(pantry, { servings, timing: timingArr, genre, maxMissing: dishCount })
        .filter(r => r.missingCount > 0)
        .slice(0, 3);

      setHomeRecipes(hr as RankedRecipe[]);
      setShopRecipes(sr as RankedRecipe[]);
      setHasSearched(true);
      setIsSearching(false);
      track("search_performed", { homeCount: hr.length, shopCount: sr.length, appMode });
    }, 500);
  };

  useEffect(() => {
    if (loaded && !hasSearched) {
      // First load automatic search
      performSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const handleCook = (recipe: RankedRecipe) => {
    setPantry(prev => decrementPantry(prev, recipe));
    addCookEvent({ recipeId: recipe.id, cookedAt: new Date().toISOString(), servings });
    setToast(recipe.name);
    setTimeout(() => setToast(null), 3000);
  };

  const displayServings = `${servings * mealCount}人前`;

  if (!loaded) return (
    <div className="flex items-center justify-center h-screen font-mincho text-pantry-text-light">読み込み中...</div>
  );

  const grouped = CATEGORIES.map(c => ({
    ...c,
    items: pantry.filter(p => p.category === c.id),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-pantry-bg via-[#f5ede0] to-[#f0e8d8] pb-10">
      {/* Toast */}
      {toast && (
        <div className="fixed top-[70px] left-1/2 -translate-x-1/2 z-50 bg-pantry-success text-white px-5 py-2.5 rounded-xl text-sm font-mincho shadow-lg"
          style={{ animation: "slideUp 0.3s" }}>
          🍳 {toast}を作りました！
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-pantry-bg/90 backdrop-blur-md border-b border-pantry-border">
        <div className="max-w-[640px] mx-auto px-4 py-2.5 flex items-center gap-2">
          <span className="text-2xl">🍳</span>
          <h1 className="text-lg font-bold text-pantry-text font-mincho tracking-wide">うちの食材で何つくる？</h1>
        </div>
        <div className="max-w-[640px] mx-auto flex border-t border-pantry-border">
          {([["home", "🏠 今日のおすすめ"], ["pantry", "🧊 うちの食材"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id as any); track("mode_switched", { to: id }); }}
              className={`flex-1 py-2.5 text-[13px] font-mincho transition-all border-b-[2.5px] ${tab === id ? "font-bold text-pantry-accent border-pantry-accent" : "text-pantry-text-light border-transparent"
                }`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-4 py-4">
        {/* Guide / Mode Selection */}
        <div className="mb-4 bg-white/60 p-3 rounded-xl border border-pantry-accent-light shadow-sm text-[13px] font-mincho text-pantry-text">
          <div className="flex justify-between items-center mb-2">
            <strong>📖 使い方</strong>
            <select value={appMode} onChange={e => { setAppMode(e.target.value as any); if (e.target.value === "quick") setPantry([]); }}
              className="px-2 py-1 rounded bg-pantry-bg border border-pantry-accent text-[12px] font-bold text-pantry-accent">
              <option value="pantry">しっかり管理モード</option>
              <option value="quick">お手軽モード</option>
            </select>
          </div>
          <p className="text-[#6a5520] leading-relaxed text-xs">
            {appMode === "pantry"
              ? "「うちの食材」タブにすべての家にあるものを登録しておくと、今から買い物なしで作れるレシピを自動提案します。"
              : "今回使いたい食材だけをサクッと登録して、作れるレシピを探すお手軽モードです。（※モードを切り替えると現在の在庫表示はリセットされます）"}
          </p>
        </div>

        {tab === "home" && (
          <>
            {appMode === "quick" && (
              <div className="bg-[#fdfbf7] p-3 rounded-xl border border-pantry-border shadow-sm mb-4">
                <div className="text-[13px] font-bold text-pantry-text-mid mb-2 flex justify-between items-center">
                  <span>🛍️ 今回使う食材</span>
                  <Badge>{pantry.length}品</Badge>
                </div>
                {pantry.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-3">
                    {pantry.map(item => (
                      <div key={item.id} className="flex justify-between items-center text-[13px] bg-white border border-[#efe6d4] px-2 py-1.5 rounded font-mincho text-pantry-text">
                        <span>{item.name}</span>
                        <div className="flex gap-3 items-center">
                          <span className="text-pantry-text-light">{item.amount}{item.unit}</span>
                          <button onClick={() => setPantry(p => p.filter(i => i.id !== item.id))} className="text-red-400 font-sans text-lg mb-0.5 leading-none hover:opacity-70">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <QuickAddItem onAdd={item => setPantry(p => [...p, item])} />
              </div>
            )}

            {/* Options */}
            <div className="bg-pantry-card border border-pantry-border rounded-xl p-3.5 mb-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-bold text-pantry-text-mid">食べる人数</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setServings(n)}
                        className={`w-12 py-1.5 rounded-lg text-[13px] font-semibold font-mincho border transition-all ${servings === n ? "bg-pantry-accent text-white border-pantry-accent shadow-sm" : "bg-pantry-bg text-pantry-accent border-pantry-accent-light"
                          }`}>
                        {n}人
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => setShowOptions(!showOptions)}
                  className="text-left text-[12px] font-bold text-pantry-text-light flex justify-between items-center border-t border-dashed border-[#efe6d4] pt-2">
                  <span>⚙️ オプション（詳細検索）</span>
                  <span className="bg-[rgba(120,90,60,0.05)] px-2 py-0.5 rounded">{showOptions ? "閉じる ▴" : "開く ▾"}</span>
                </button>

                {showOptions && (
                  <div className="grid grid-cols-2 gap-3 pb-1">
                    <div>
                      <label className="text-[11px] font-bold text-pantry-text-mid block mb-1">食事のタイミング</label>
                      <select value={timing} onChange={e => setTiming(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-pantry-accent-light bg-pantry-bg font-mincho text-[13px] text-pantry-text">
                        {TIMINGS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-pantry-text-mid block mb-1">ジャンル</label>
                      <select value={genre} onChange={e => setGenre(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-pantry-accent-light bg-pantry-bg font-mincho text-[13px] text-pantry-text">
                        {GENRES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 mt-1">
                      <label className="text-[11px] font-bold text-pantry-text-mid block mb-1">買い足す食材の上限</label>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 5].map(n => (
                          <button key={n} onClick={() => setDishCount(n)}
                            className={`flex-1 py-1 rounded-lg text-[12px] font-semibold font-mincho border transition-all ${dishCount === n ? "bg-pantry-warn text-white border-pantry-warn shadow-sm" : "bg-pantry-bg text-pantry-warn border-[#f0d890]"
                              }`}>
                            {n === 0 ? "なし" : `${n}品まで`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Home Recipes */}
            <div className="mb-6">
              <h2 className="text-[15px] font-bold text-pantry-text font-mincho mb-2.5 flex items-center gap-1.5">
                🏠 買い物なしで作れるレシピ <Badge variant="success">{homeRecipes.length}件</Badge>
              </h2>

              {homeRecipes.length > 1 && (
                <div className="mb-3 text-[11px] text-[#6a5520] bg-[rgba(120,90,60,0.05)] p-2 rounded flex items-center gap-1.5 font-mincho">
                  <span>💡 この中からどれか1つを選んで作れます（※作ると在庫が減ります）</span>
                </div>
              )}

              {pantry.length === 0 ? (
                <div className="text-center py-6 text-pantry-text-light text-[13px] leading-relaxed">
                  <div className="text-3xl mb-2">🧊</div>
                  食材が登録されていません。<br />
                  {appMode === "quick" ? "上の入力欄から食材を追加してください。" : (
                    <><button onClick={() => setTab("pantry")} className="text-pantry-accent underline hover:opacity-80 font-bold">「うちの食材」タブ</button>から食材を追加してください。</>
                  )}
                </div>
              ) : homeRecipes.length === 0 ? (
                <div className="text-center py-6 px-4 text-pantry-text-light text-[13px] bg-white rounded-xl border border-dashed border-[#efe6d4] shadow-sm">
                  <div className="text-4xl mb-3">😅</div>
                  <strong className="text-pantry-text-mid block mb-2 text-[14px]">条件に一致するレシピが見つかりませんでした</strong>
                  <p className="text-xs leading-relaxed text-[#6a5520]">
                    「ジャンル」を "すべて" にするか、<br />
                    「買い足す食材の上限」を増やしてみてください。
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {homeRecipes.map(r => (
                    <RecipeCard key={r.id} r={{ ...r, displayServings }} mode="home" onCook={handleCook} />
                  ))}
                </div>
              )}
            </div>

            {/* Shopping Recipes */}
            <div>
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <h2 className="text-[15px] font-bold text-pantry-text font-mincho flex items-center gap-1.5 m-0">
                  🛒 少し買い足して作れるレシピ
                </h2>
              </div>

              {shopRecipes.length > 0 && <ShoppingMemo recipes={shopRecipes} />}

              {pantry.length === 0 ? null : shopRecipes.length === 0 ? (
                <div className="text-center py-5 text-pantry-text-light text-[13px]">
                  <div className="text-2xl mb-1">🎉</div>
                  買い物なしでたくさん作れます！
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {shopRecipes.map(r => (
                    <RecipeCard key={r.id} r={{ ...r, displayServings }} mode="shopping" onCook={handleCook} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "pantry" && (
          <>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[15px] font-bold text-pantry-text font-mincho flex items-center gap-1.5 m-0">
                🧊 うちの食材 <Badge>{pantry.length}品目</Badge>
              </h2>
              {appMode === "pantry" && (
                <button onClick={() => { setPantry(SAMPLE_PANTRY); track("pantry_edited", { action: "load_sample" }); }}
                  className="text-[12px] px-2.5 py-1 rounded-lg border border-pantry-accent-light text-pantry-accent font-mincho hover:bg-[rgba(120,90,60,0.06)] transition-colors">
                  サンプル投入
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {grouped.map(g => (
                <div key={g.id} className="bg-pantry-card border border-pantry-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-3 py-2 bg-[rgba(120,90,60,0.04)] border-b border-[#efe6d4] flex items-center gap-1.5">
                    <span>{g.emoji}</span>
                    <span className="text-[13px] font-bold text-pantry-text-mid">{g.label}</span>
                    <span className="text-[11px] text-pantry-text-light">({g.items.length})</span>
                  </div>
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {g.items.map(item => (
                      <PantryItemRow key={item.id} item={item}
                        onUpdate={u => setPantry(p => p.map(i => i.id === u.id ? u : i))}
                        onDelete={id => setPantry(p => p.filter(i => i.id !== id))} />
                    ))}
                    <AddItemInline onAdd={item => setPantry(p => [...p, item])} category={g.id} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 p-3.5 bg-pantry-card border border-pantry-border rounded-xl">
              <div className="text-[13px] font-bold text-pantry-text-mid mb-1.5">💡 ヒント</div>
              <div className="text-[12px] text-pantry-text-light leading-relaxed space-y-1">
                <p>・「✏️ 編集」ボタンから量や期限を変更できます</p>
                <p>・おすすめ画面で「作った！」ボタンを押すと在庫が自動減算されます</p>
                <p>・データはログイン不要でブラウザに自動保存されます</p>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-5 text-[11px] text-[#c4b898]">
        レシピDB: {recipes.length}品 ・ 在庫: {pantry.length}品目
      </footer>
    </div>
  );
}
