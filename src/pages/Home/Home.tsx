import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import GridLayout from "react-grid-layout/legacy";
import type { Layout, LayoutItem } from "react-grid-layout/legacy";
import { Add, Edit, Export, Info, LanguageSwitcher } from "@components";
import { Card } from "@ui";
import "react-grid-layout/css/styles.css";
import styles from "./home.module.css";
import { CARDS, type Lang } from "./data";
import modules from "@modules";

const CELL = 20;
const GAP = 20;
const COLS = 125;
const GRID_WIDTH = (CELL + GAP) * COLS - GAP;
const STORAGE_KEY = "home.layout.v4";

const CARDS_BY_ID = new Map(CARDS.map((c) => [c.i, c]));
const MODULE_SETTINGS = new Map(
  Object.values(modules)
    .filter((m) => m.settings)
    .map((m) => [m.config.i, m.settings!])
);

function toLayoutItem(card: (typeof CARDS)[number]): LayoutItem {
  const { i, x, y, w, h, minW, minH, maxW, maxH, static: isStatic } = card;
  return { i, x, y, w, h, minW, minH, maxW, maxH, static: isStatic };
}

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return CARDS.map(toLayoutItem);
    const stored = JSON.parse(raw) as LayoutItem[];
    return stored.filter((it) => CARDS_BY_ID.has(it.i));
  } catch {
    return CARDS.map(toLayoutItem);
  }
}

function nextY(layout: Layout): number {
  return layout.reduce((max, it) => Math.max(max, it.y + it.h), 0);
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const [layout, setLayout] = useState<Layout>(loadLayout);

  const persist = (next: Layout) => {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    function onIFrameLayout(e: Event) {
      const { i, x, y, w, h } = (e as CustomEvent<{ i: string; x: number; y: number; w: number; h: number }>).detail;
      setLayout((prev) => {
        const next = prev.map((it) => (it.i === i ? { ...it, x, y, w, h } : it));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
    window.addEventListener("iframe:update-layout", onIFrameLayout);
    return () => window.removeEventListener("iframe:update-layout", onIFrameLayout);
  }, []);

  const present = new Set(layout.map((it) => it.i));
  const addItems = CARDS.filter((c) => !present.has(c.i)).map((c) => ({
    id: c.i,
    label: c.title[lang],
  }));

  const handleAdd = (id: string) => {
    const card = CARDS_BY_ID.get(id);
    if (!card || present.has(id)) return;
    persist([...layout, { ...toLayoutItem(card), x: 0, y: nextY(layout) }]);
  };

  const handleDelete = (id: string) => {
    persist(layout.filter((it) => it.i !== id));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("home.title")}</h1>
        <div className={styles.actions}>
          <Add items={addItems} onAdd={handleAdd} />
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
          const card = CARDS_BY_ID.get(item.i);
          if (!card) return null;
          return (
            <div key={item.i}>
              <Card
                title={card.title[lang]}
                actions={
                  <>
                    <Info
                      title={card.title[lang]}
                      dataSource={card.info.dataSource[lang]}
                      refreshFrequency={card.info.refreshFrequency[lang]}
                      lastUpdated={card.info.lastUpdated}
                    />
                    <Export />
                    <Edit onDelete={() => handleDelete(item.i)} settings={MODULE_SETTINGS.get(item.i)} />
                  </>
                }
              >
                {card.content}
              </Card>
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
