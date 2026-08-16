import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton } from "@ui";

type ResetProps = {
  /**
   * Put the card back to a clean state. Unlike Refresh — which re-reads the data the card is
   * already showing — this throws that state away. Registered the same way, so the button only
   * appears for cards that register a handler (see `_setReset` in Home).
   */
  onReset: () => void | Promise<void>;
};

export default function Reset({ onReset }: ResetProps) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);

  async function handleClick() {
    if (running) return;
    setRunning(true);
    try {
      await onReset();
    } finally {
      setRunning(false);
    }
  }

  return (
    <ActionButton tooltip={t("reset.tooltip")} onClick={handleClick}>
      {/* Anticlockwise arrow: back to the start. The mirror of Refresh's, which goes forward */}
      <svg viewBox="0 0 24 24">
        <path d="M4 12a8 8 0 1 0 2.34-5.66" />
        <path d="M4 4v5h5" />
      </svg>
    </ActionButton>
  );
}
