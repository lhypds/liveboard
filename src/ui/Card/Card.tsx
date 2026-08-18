import type { ReactNode } from "react";
import styles from "./card.module.css";

type Props = {
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export default function Card({ title, actions, children }: Props) {
  return (
    <div className={styles.card} data-modal-boundary>
      <div className={`${styles.header} card-drag-handle`}>
        <span className={styles.title}>{title}</span>
        {/* `data-card-actions` is what keeps the board's drag off this strip — the grid
            is told to cancel a drag that starts here (see Home's `draggableCancel`).
            It has to be the grid's own check: the drag listens on `touchstart` and
            `mousedown`, so stopping propagation on a pointer event never reaches it. */}
        {actions && (
          <div className={styles.actions} data-card-actions>
            {actions}
          </div>
        )}
      </div>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
