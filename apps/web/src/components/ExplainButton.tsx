interface ExplainButtonProps {
  label: string;
  onClick: () => void;
}

export function ExplainButton({ label, onClick }: ExplainButtonProps) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`Visa metod för ${label}`}
      onClick={onClick}
    >
      i
    </button>
  );
}
