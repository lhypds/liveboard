import { useTranslation } from "react-i18next";
import { ActionButton } from "@ui";

type DuplicateProps = {
  id: string;
  onDuplicate: (id: string) => void;
};

export default function Duplicate({ id, onDuplicate }: DuplicateProps) {
  const { t } = useTranslation();

  return (
    <ActionButton tooltip={t("duplicate.tooltip")} onClick={() => onDuplicate(id)}>
      <svg viewBox="0 0 24 24">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </ActionButton>
  );
}
