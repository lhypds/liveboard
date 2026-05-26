import type { ReactNode } from "react";
import styles from "./card.module.css";

type Props = {
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export default function Card({ title, actions, children }: Props) {
  return (
    <div className={styles.card}>
      <div className={`${styles.header} card-drag-handle`}>
        <span className={styles.title}>{title}</span>
        {actions && (
          <div className={styles.actions} onPointerDown={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
