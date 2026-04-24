"use client";

type ConfirmDeleteButtonProps = {
  className: string;
  confirmText?: string;
  children: React.ReactNode;
};

export default function ConfirmDeleteButton({
  className,
  confirmText = "¿Seguro que quieres eliminar este gasto?",
  children,
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
