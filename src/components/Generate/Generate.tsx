import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActionButton, Modal, TextArea } from "@ui";
import { generateEdit, NoScCredentialError } from "@utils/sc";
import styles from "./generate.module.css";

/**
 * How often the streaming text is pushed into the card. Every token would re-save
 * the whole board that many times; at this interval the text still arrives as a
 * steady stream to watch, and the final version is written unconditionally.
 */
const STREAM_INTERVAL_MS = 60;

/** How long a failure stays on the card before it clears itself */
const ERROR_HOLD_MS = 5000;

/**
 * What the card shows mid-stream: the answer so far laid over the text that is
 * already there, so the old words are overwritten in place instead of the card
 * being blanked first.
 *
 * The overlay is line by line, not character by character. Splicing on a raw
 * index would let a newline in the answer shift everything the answer hasn't
 * reached yet down a row, and the old text would crawl down the card as it went.
 * Overwriting within each line keeps every untouched line where it was: finished
 * lines replace theirs outright, the line being written keeps the tail of the one
 * underneath it, and the rest are left alone.
 */
function overlay(partial: string, original: string): string {
  const written = partial.split("\n");
  const lines = original.split("\n");
  for (let i = 0; i < written.length; i++) {
    const line = written[i];
    const under = lines[i] ?? "";
    lines[i] = i === written.length - 1 ? line + under.slice(line.length) : line;
  }
  return lines.join("\n");
}

type GenerateProps = {
  /** The card's current text; what gets rewritten */
  content: string;
  /**
   * The card's `prompt` config: a standing description of the scenario, so the
   * model knows what this content is before it reads the instruction
   */
  prompt?: string;
  /** Modal heading; defaults to the shared "Generate" label */
  title?: string;
  /** Replaces the card's text — called repeatedly as the answer streams in */
  onGenerated: (next: string) => void;
  /** What to show over the card's content while it works; "" clears it */
  onStatus?: (status: string, isError?: boolean) => void;
};

export default function Generate({ content, prompt, title, onGenerated, onStatus }: GenerateProps) {
  const { t } = useTranslation();
  const label = t("generate.tooltip");
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A card unmounted (deleted, board switched) mid-generation shouldn't leave the
  // request running, nor a status stuck on the card it came back to
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    },
    [],
  );

  function fail(message: string) {
    onStatus?.(message, true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => onStatus?.(""), ERROR_HOLD_MS);
  }

  async function handleGenerate() {
    const edit = instruction.trim();
    // An empty card is fine — that asks for a first draft rather than a rewrite
    if (loading || !edit) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    // The note sits behind this modal, so get out of its way before the text
    // starts landing in it. From here on, progress is shown over the card
    setOpen(false);
    setInstruction("");
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    onStatus?.(t("generate.working"));

    let streamed = false;
    let lastWrite = 0;
    try {
      const next = await generateEdit({
        content,
        instruct: prompt,
        prompt: edit,
        // Until the first words land there is nothing to watch, so the card
        // carries whatever simple-ai is doing; after that the text speaks for itself
        onStatus: (status) => {
          if (!streamed && !controller.signal.aborted) onStatus?.(status);
        },
        onText: (partial) => {
          if (controller.signal.aborted) return;
          if (!streamed) {
            streamed = true;
            onStatus?.("");
          }
          const now = Date.now();
          if (now - lastWrite < STREAM_INTERVAL_MS) return;
          lastWrite = now;
          // The final write below trims whatever of the original is left over
          onGenerated(overlay(partial, content));
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!next.trim()) {
        fail(t("generate.emptyResult"));
        return;
      }
      onStatus?.("");
      // The throttle may have skipped the last chunks
      onGenerated(next);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof NoScCredentialError) fail(t("generate.noCredential"));
      else fail(err instanceof Error && err.message ? err.message : t("generate.failed"));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  }

  return (
    <>
      <ActionButton tooltip={label} onClick={() => setOpen(true)}>
        {/* Brain, after the one on the q project's generate button. Two lobes and a
            midline rather than q's five paths: card icons render at 10px with a
            stroke 2 units wide, at which q's outline closes into a solid blob */}
        <svg viewBox="0 0 24 24">
          <path d="M12 4.5A4.5 4.5 0 0 0 4 7.3 4 4 0 0 0 3.2 14 4.6 4.6 0 0 0 12 19.5" />
          <path d="M12 4.5A4.5 4.5 0 0 1 20 7.3 4 4 0 0 1 20.8 14 4.6 4.6 0 0 1 12 19.5" />
          <path d="M12 4.5v15" />
        </svg>
      </ActionButton>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title ?? label}>
        <TextArea
          className={styles.instruction}
          value={instruction}
          placeholder={t("generate.placeholder")}
          disabled={loading}
          autoFocus
          minHeight={120}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInstruction(e.target.value)}
        />
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.generateButton}
            onClick={handleGenerate}
            disabled={loading || !instruction.trim()}
          >
            {loading ? t("generate.working") : t("generate.action")}
          </button>
          <button type="button" className={styles.cancelButton} onClick={() => setOpen(false)} disabled={loading}>
            {t("button.cancel")}
          </button>
        </div>
      </Modal>
    </>
  );
}
