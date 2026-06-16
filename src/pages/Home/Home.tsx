import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import GridLayout from "react-grid-layout/legacy";
import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import { Add, Edit, Export, Info, LanguageSwitcher, LayoutIO, Refresh } from "@components";
import { Card } from "@ui";
import "react-grid-layout/css/styles.css";
import styles from "./home.module.css";
import { CARDS, type Lang } from "./data";

const CELL = 20;
const GAP = 20;
const COLS = 125;
const GRID_WIDTH = (CELL + GAP) * COLS - GAP;
const STORAGE_KEY = "home.layout.v4";

type StoredItem = LayoutItem & { config?: Record<string, unknown> };

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

function loadStored(): StoredItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CARDS.map(toLayoutItem);
    return (JSON.parse(raw) as StoredItem[]).filter((it) => CARDS_BY_ID.has(moduleId(it.i)));
  } catch {
    return CARDS.map(toLayoutItem);
  }
}

function nextY(layout: Layout): number {
  return layout.reduce((max, it) => Math.max(max, it.y + it.h), 0);
}

type InfoItem = { key: Record<string, string>; value: Record<string, string> };
type InfoSection = { title: Record<string, string>; items: InfoItem[] };

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [layout, setLayout] = useState<Layout>(loadStored);

  useEffect(() => {
    document.title = t("home.title");
  }, [t, i18n.language]);

  const [configs, setConfigs] = useState<Record<string, Record<string, unknown>>>(() =>
    Object.fromEntries(
      loadStored()
        .filter((it): it is StoredItem & { config: Record<string, unknown> } => Boolean(it.config))
        .map((it) => [it.i, it.config]),
    ),
  );

  const saveToStorage = (nextLayout: Layout, nextConfigs: typeof configs) => {
    const toStore: StoredItem[] = nextLayout.map((item) => ({
      ...item,
      ...(nextConfigs[item.i] ? { config: nextConfigs[item.i] } : {}),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  };

  const persist = (next: Layout) => {
    setLayout(next);
    saveToStorage(next, configs);
  };

  const handleSaveConfig = (id: string, saved: Record<string, unknown>) => {
    const layoutPatch: Record<string, unknown> = {};
    const moduleConfig: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(saved)) {
      if (LAYOUT_FIELDS.has(k)) layoutPatch[k] = v;
      else moduleConfig[k] = v;
    }

    const nextLayout = layout.map((item) => (item.i === id ? { ...item, ...layoutPatch } : item));
    const nextConfigs = { ...configs, [id]: moduleConfig };

    setLayout(nextLayout);
    setConfigs(nextConfigs);
    saveToStorage(nextLayout, nextConfigs);
  };

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
    const newLayout = [...layout, { ...toLayoutItem(card), i: instanceId, x: 0, y: nextY(layout) }];
    const defaultConfig: Record<string, unknown> = {
      title: { ...card.title },
      refreshAgeMinutes: card.refreshAgeMinutes,
      info: card.info.map((section) => ({
        title: { ...section.title },
        items: section.items.map((item) => ({ key: { ...item.key }, value: { ...item.value } })),
      })),
      ...(card.comp ? { comp: { ...card.comp } } : {}),
    };
    const nextConfigs = { ...configs, [instanceId]: defaultConfig };
    setLayout(newLayout);
    setConfigs(nextConfigs);
    saveToStorage(newLayout, nextConfigs);
  };

  const handleDelete = (id: string) => {
    persist(layout.filter((it) => it.i !== id));
  };

  const handleImport = (nextLayout: Layout, nextConfigs: typeof configs) => {
    const filtered = nextLayout.filter((it) => CARDS_BY_ID.has(moduleId(it.i)));
    const filteredIds = new Set(filtered.map((it) => it.i));
    const filteredConfigs = Object.fromEntries(Object.entries(nextConfigs).filter(([id]) => filteredIds.has(id)));
    setLayout(filtered);
    setConfigs(filteredConfigs);
    saveToStorage(filtered, filteredConfigs);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("home.title")}</h1>
        <div className={styles.actions}>
          <Add items={addItems} onAdd={handleAdd} />
          <LayoutIO layout={layout} configs={configs} onImport={handleImport} />
          <LanguageSwitcher />
        </div>
      </header>

      <GridLayout
        className={styles.content}
        layout={layout}
        onLayoutChange={persist}
        cols={COLS}
        rowHeight={CELL}
        margin={[GAP, GAP]}
        containerPadding={[0, 0]}
        draggableHandle=".card-drag-handle"
        width={GRID_WIDTH}
      >
        {layout.map((item) => {
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

          return (
            <div key={item.i}>
              <Card
                title={displayTitle}
                actions={
                  <>
                    {card.hasRefresh && <Refresh moduleId={moduleId(item.i)} />}
                    <Info title={displayTitle} sections={displaySections} lastUpdated={displayLastUpdated} />
                    <Export />
                    <Edit config={editConfig} onSave={(c) => handleSaveConfig(item.i, c)} onDelete={() => handleDelete(item.i)} />
                  </>
                }
              >
                {card.content(cfg)}
              </Card>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
