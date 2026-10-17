import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialog({
  title,
  children,
  onClose,
  confirm,
  onConfirm,
  destructive = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  confirm: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        type="button"
        className="icon-button dialog-close"
        aria-label="닫기"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <h2 id="dialog-title">{title}</h2>
      <div className="dialog-copy">{children}</div>
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose} autoFocus>
          취소
        </button>
        <button
          className={`button ${destructive ? "danger" : "primary"}`}
          onClick={onConfirm}
        >
          {confirm}
        </button>
      </div>
    </dialog>
  );
}
