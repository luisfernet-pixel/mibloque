"use client";

type ConfirmActionButtonProps = {
  className: string;
  confirmText: string;
  children: React.ReactNode;
};

export default function ConfirmActionButton({
  className,
  confirmText,
  children,
}: ConfirmActionButtonProps) {
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
