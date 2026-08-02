import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import GridLayout from "react-grid-layout/legacy";
import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import { Add, BoardSwitcher, Duplicate, Edit, Export, Info, LanguageSwitcher, LayoutIO, Refresh, Reset, User } from "@components";
import { Card } from "@ui";
import "react-grid-layout/css/styles.css";
import styles from "./home.module.css";
import { CARDS, type Lang } from "./data";

// One grid unit = one background dot (20px); the visual gap between cards
// comes from padding inside each grid item (see home.module.css)
const CELL = 20;
const COLS = 250;
const GRID_WIDTH = CELL * COLS;
const STORAGE_KEY = "home.boards.v1";
// Pre-multi-board keys, each holding a single layout
const LEGACY_STORAGE_KEY = "home.layout.v5";
const LEGACY_V4_STORAGE_KEY = "home.layout.v4";
const MOBILE_BREAKPOINT = 720;

function useIsMobile(breakpoint: number): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(`(max-width: ${breakpoint}px)`).matches);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

type StoredItem = LayoutItem & { config?: Record<string, unknown> };

// A board is one layout: the grid items plus their per-card config, and an
// optional per-language display name (defaults to "Board N" when absent)
type Board = { name?: Record<string, string>; items: StoredItem[] };
type Store = { boards: Board[]; active: number };
// What the board-settings modal edits; older exports/drafts may still be a bare item array
type BoardConfig = { name?: Record<string, string>; items?: StoredItem[] } | StoredItem[];

const LANGS: Lang[] = ["en", "zh", "ja"];

const LAYOUT_FIELDS = new Set(["x", "y", "w", "h", "minW", "minH", "maxW", "maxH"]);

const CARDS_BY_ID = new Map(CARDS.map((c) => [c.i, c]));

function moduleId(instanceId: string): string {
  const sep = instanceId.indexOf(":");
  return sep === -1 ? instanceId : instanceId.slice(0, sep);
}

function toLayoutItem(card: (typeof CARDS)[number]): LayoutItem {
  const { i, x, y, w, h, minW, minH, maxW, maxH, static: isStatic } = card;
  return { i, x, y, w, h, minW, minH, maxW, maxH, static: isStatic };
}

// v4 grid units were 2 dots (20px cell + 20px margin); v5 units are 1 dot
function migrateLegacy(items: StoredItem[]): StoredItem[] {
  return items.map((it) => {
    const next = { ...it };
    for (const k of ["x", "y", "w", "h", "minW", "minH", "maxW", "maxH"] as const) {
      if (typeof next[k] === "number") next[k] = next[k] * 2;
    }
    return next;
  });
}

function toGridLayout(items: StoredItem[]): Layout {
  return items.map((it) => {
    const item = { ...it };
    delete item.config;
    return item;
  });
}

// Drops anything that isn't a grid item of a module this build still ships
function sanitize(items: unknown): StoredItem[] {
  if (!Array.isArray(items)) return [];
  return (items as StoredItem[]).filter((it) => it && typeof it.i === "string" && CARDS_BY_ID.has(moduleId(it.i)));
}

// Keeps only non-empty strings for known languages; undefined means "use the default label"
function sanitizeName(name: unknown): Record<string, string> | undefined {
  if (!name || typeof name !== "object" || Array.isArray(name)) return undefined;
  const out: Record<string, string> = {};
  for (const lng of LANGS) {
    const v = (name as Record<string, unknown>)[lng];
    if (typeof v === "string" && v.trim()) out[lng] = v.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

// Accepts both stored shapes: a bare item array (pre-name era) or { name, items }
function toBoard(entry: unknown): Board {
  if (Array.isArray(entry)) return { items: sanitize(entry) };
  if (entry && typeof entry === "object") {
    const b = entry as { name?: unknown; items?: unknown };
    const name = sanitizeName(b.name);
    return { ...(name ? { name } : {}), items: sanitize(b.items) };
  }
  return { items: [] };
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { boards?: unknown[]; active?: number };
      const boards = Array.isArray(parsed?.boards) ? parsed.boards.map(toBoard) : [];
      if (boards.length) {
        return { boards, active: Math.min(Math.max(parsed.active ?? 0, 0), boards.length - 1) };
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return { boards: [{ items: sanitize(JSON.parse(legacy)) }], active: 0 };
    const legacyV4 = localStorage.getItem(LEGACY_V4_STORAGE_KEY);
    if (legacyV4)
      return { boards: [{ items: sanitize(migrateLegacy(JSON.parse(legacyV4) as StoredItem[])) }], active: 0 };
  } catch {
    // fall through to a single empty board
  }
  return { boards: [{ items: [] }], active: 0 };
}

function nextY(layout: Layout): number {
  return layout.reduce((max, it) => Math.max(max, it.y + it.h), 0);
}

type InfoItem = { key: Record<string, string>; value: Record<string, string> };
type InfoSection = { title: Record<string, string>; items: InfoItem[] };

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [store, setStore] = useState<Store>(loadStore);
  const isMobile = useIsMobile(MOBILE_BREAKPOINT);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  // A card that can put itself back to a clean state registers how (see `_setReset` below),
  // and gets a Reset button in its header. Keyed by instance id, so one Chat card resetting
  // leaves the others alone.
  const [resetHandlers, setResetHandlers] = useState<Record<string, () => void | Promise<void>>>({});

  useEffect(() => {
    document.title = t("home.title");
  }, [t, i18n.language]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  const items = useMemo(() => store.boards[store.active]?.items ?? [], [store]);

  // The active board split into what the grid needs and what the cards need
  const layout = useMemo<Layout>(() => toGridLayout(items), [items]);
  const configs = useMemo<Record<string, Record<string, unknown>>>(
    () =>
      Object.fromEntries(
        items
          .filter((it): it is StoredItem & { config: Record<string, unknown> } => Boolean(it.config))
          .map((it) => [it.i, it.config]),
      ),
    [items],
  );

  const updateItems = (next: (prev: StoredItem[]) => StoredItem[]) => {
    setStore((prev) => ({
      ...prev,
      boards: prev.boards.map((board, idx) => (idx === prev.active ? { ...board, items: next(board.items) } : board)),
    }));
  };

  const toStored = (nextLayout: Layout, nextConfigs: typeof configs): StoredItem[] =>
    nextLayout.map((item) => ({
      ...item,
      ...(nextConfigs[item.i] ? { config: nextConfigs[item.i] } : {}),
    }));

  const persist = (next: Layout) => {
    updateItems((prev) => {
      const prevConfigs = Object.fromEntries(prev.filter((it) => it.config).map((it) => [it.i, it.config!]));
      return toStored(next, prevConfigs);
    });
  };

  const handleSaveConfig = (id: string, saved: Record<string, unknown>) => {
    const layoutPatch: Record<string, unknown> = {};
    const moduleConfig: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(saved)) {
      if (LAYOUT_FIELDS.has(k)) layoutPatch[k] = v;
      else moduleConfig[k] = v;
    }

    updateItems((prev) => prev.map((it) => (it.i === id ? { ...it, ...layoutPatch, config: moduleConfig } : it)));
  };

  // Custom name in the current language, else any language it was set in, else "Board N"
  const boardNames = store.boards.map(
    (board, i) =>
      board.name?.[lang] ?? LANGS.map((l) => board.name?.[l]).find(Boolean) ?? t("board.label", { n: i + 1 }),
  );

  // The settings modal pre-fills the default label in every language so the shape is visible
  const defaultBoardName = (n: number): Record<string, string> =>
    Object.fromEntries(LANGS.map((l) => [l, i18n.getFixedT(l)("board.label", { n })]));

  const activeModuleIds = new Set(layout.map((it) => moduleId(it.i)));
  const addItems = CARDS.map((c) => ({
    id: c.i,
    label: c.title[lang],
    disabled: c.allowMultipleInstances === false && activeModuleIds.has(c.i),
  }));

  const handleAdd = (id: string) => {
    const card = CARDS_BY_ID.get(id);
    if (!card) return;
    const instanceId = `${id}:${Date.now()}`;
    const defaultConfig: Record<string, unknown> = {
      title: { ...card.title },
      refreshAgeMinutes: card.refreshAgeMinutes,
      info: card.info.map((section) => ({
        title: { ...section.title },
        items: section.items.map((item) => ({ key: { ...item.key }, value: { ...item.value } })),
      })),
      ...(card.comp ? { comp: { ...card.comp } } : {}),
    };
    updateItems((prev) => [
      ...prev,
      { ...toLayoutItem(card), i: instanceId, x: 0, y: nextY(prev), config: defaultConfig },
    ]);
  };

  const handleDuplicate = (id: string) => {
    updateItems((prev) => {
      const source = prev.find((it) => it.i === id);
      if (!source) return prev;
      const instanceId = `${moduleId(id)}:${Date.now()}`;
      return [
        ...prev,
        {
          ...source,
          i: instanceId,
          x: 0,
          y: nextY(prev),
          ...(source.config ? { config: structuredClone(source.config) } : {}),
        },
      ];
    });
  };

  const handleDelete = (id: string) => {
    updateItems((prev) => prev.filter((it) => it.i !== id));
  };

  const handleImport = (nextLayout: Layout, nextConfigs: typeof configs) => {
    updateItems(() => sanitize(toStored(nextLayout, nextConfigs)));
  };

  const handleSelectBoard = (index: number) => {
    setStore((prev) => ({ ...prev, active: index }));
  };

  const handleAddBoard = () => {
    setStore((prev) => ({ boards: [...prev.boards, { items: [] }], active: prev.boards.length }));
  };

  const handleSaveBoard = (next: BoardConfig) => {
    setStore((prev) => ({
      ...prev,
      boards: prev.boards.map((board, idx) => {
        if (idx !== prev.active) return board;
        if (Array.isArray(next)) return { ...board, items: sanitize(next) };
        const name = sanitizeName(next.name);
        return { ...(name ? { name } : {}), items: sanitize(next.items) };
      }),
    }));
  };

  // A layout downloaded from the user's server folder replaces the whole
  // store (all boards), running through the same sanitizing as loadStore
  const handleRestore = (data: unknown): boolean => {
    if (!data || typeof data !== "object") return false;
    const parsed = data as { boards?: unknown[]; active?: number };
    if (!Array.isArray(parsed.boards) || !parsed.boards.length) return false;
    const boards = parsed.boards.map(toBoard);
    setStore({ boards, active: Math.min(Math.max(parsed.active ?? 0, 0), boards.length - 1) });
    return true;
  };

  // Removing the last board leaves an empty one behind — there is always a board
  const handleDeleteBoard = () => {
    setStore((prev) => {
      const boards = prev.boards.filter((_, idx) => idx !== prev.active);
      if (!boards.length) return { boards: [{ items: [] }], active: 0 };
      return { boards, active: Math.min(prev.active, boards.length - 1) };
    });
  };

  const renderCard = (item: LayoutItem) => {
    const card = CARDS_BY_ID.get(moduleId(item.i));
    if (!card) return null;
    const cfg = configs[item.i] ?? {};
    const cfgTitle = cfg.title as Record<string, string> | undefined;
    const cfgInfo = Array.isArray(cfg.info) ? (cfg.info as InfoSection[]) : undefined;
    const cfgRefreshAge = cfg.refreshAgeMinutes as number | undefined;

    const displayTitle = cfgTitle?.[lang] ?? card.title[lang];
    const displaySections = cfgInfo ?? card.info;
    const displayLastUpdated = card.fileLastUpdated;

    const editConfig: Record<string, unknown> = {
      title: cfgTitle ?? { ...card.title },
      refreshAgeMinutes: cfgRefreshAge ?? card.refreshAgeMinutes,
      info: cfgInfo ?? card.info,
      ...Object.fromEntries(
        Object.entries(cfg).filter(([k]) => k !== "title" && k !== "info" && k !== "refreshAgeMinutes"),
      ),
    };

    const isRefreshing = refreshingIds.has(item.i);
    const setRefreshing = (loading: boolean) => {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        if (loading) next.add(item.i);
        else next.delete(item.i);
        return next;
      });
    };

    return (
      <Card
        title={displayTitle}
        actions={
          <>
            {card.hasRefresh && <Refresh moduleId={moduleId(item.i)} onLoadingChange={setRefreshing} />}
            {resetHandlers[item.i] && <Reset onReset={resetHandlers[item.i]} />}
            <Info title={displayTitle} sections={displaySections} lastUpdated={displayLastUpdated} />
            <Export title={displayTitle} />
            {card.allowMultipleInstances !== false && <Duplicate id={item.i} onDuplicate={handleDuplicate} />}
            <Edit config={editConfig} onSave={(c) => handleSaveConfig(item.i, c)} onDelete={() => handleDelete(item.i)} />
          </>
        }
      >
        <div className={styles.contentWrapper}>
          {isRefreshing && <div className={styles.refreshOverlay}>{t("refresh.loading")}</div>}
          {card.content({
            ...cfg,
            // This card instance's id, for components that need to tell themselves apart
            // from a copy of the same card (e.g. Chat owns one CLI process per card)
            _id: item.i,
            // Cards that can start over say how here, which is also what puts a Reset button
            // in their header. Pass null to take it away again.
            _setReset: (fn: (() => void | Promise<void>) | null) => {
              setResetHandlers((prev) => {
                if (fn) return prev[item.i] === fn ? prev : { ...prev, [item.i]: fn };
                if (!(item.i in prev)) return prev;
                const next = { ...prev };
                delete next[item.i];
                return next;
              });
            },
            // Allows components to persist their comp config directly (e.g. Note auto-saves content on change)
            _save: (comp: Record<string, unknown>) => {
              updateItems((prev) =>
                prev.map((it) => (it.i === item.i ? { ...it, config: { ...(it.config ?? {}), comp } } : it)),
              );
            },
          })}
        </div>
      </Card>
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("home.title")}</h1>
        <div className={styles.actions}>
          <Add items={addItems} onAdd={handleAdd} />
          <BoardSwitcher
            names={boardNames}
            active={store.active}
            onSelect={handleSelectBoard}
            onAdd={handleAddBoard}
          />
          <Edit<BoardConfig>
            config={{
              name: store.boards[store.active]?.name ?? defaultBoardName(store.active + 1),
              items,
            }}
            title={t("board.edit")}
            hideTooltip
            onSave={handleSaveBoard}
            onDelete={handleDeleteBoard}
          />
          <LayoutIO layout={layout} configs={configs} onImport={handleImport} />
          <User store={store} onRestore={handleRestore} />
          <LanguageSwitcher />
        </div>
      </header>

      {isMobile ? (
        <div className={styles.mobileList}>
          {[...layout]
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map((item) => {
              const content = renderCard(item);
              if (!content) return null;
              return (
                <div key={item.i} className={styles.mobileItem} style={{ height: item.h * CELL }}>
                  {content}
                </div>
              );
            })}
        </div>
      ) : (
        <GridLayout
          key={store.active}
          className={styles.content}
          layout={layout}
          onLayoutChange={persist}
          cols={COLS}
          rowHeight={CELL}
          margin={[0, 0]}
          containerPadding={[0, 0]}
          draggableHandle=".card-drag-handle"
          width={GRID_WIDTH}
        >
          {layout.map((item) => (
            <div key={item.i}>{renderCard(item)}</div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
