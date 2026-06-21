"use client";

type ConfirmMonthLockButtonProps = {
  className: string;
  locked: boolean;
};

export default function ConfirmMonthLockButton({
  className,
  locked,
}: ConfirmMonthLockButtonProps) {
  const confirmText = locked
    ? "¿Reabrir el mes? Al hacerlo volveras a poder editar los gastos de este periodo."
    : "¿Cerrar el mes? Una vez cerrado no podras editar los gastos de este periodo.";

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
      {locked ? "Reabrir mes" : "Cerrar mes"}
    </button>
  );
}
