"use client";

type ConfirmActionButtonProps = {
  className: string;
  confirmText: string;
  secondConfirmText?: string;
  children: React.ReactNode;
};

export default function ConfirmActionButton({
  className,
  confirmText,
  secondConfirmText,
  children,
}: ConfirmActionButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmText) || (secondConfirmText && !window.confirm(secondConfirmText))) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
