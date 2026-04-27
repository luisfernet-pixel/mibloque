type CellState = "pagado" | "pendiente" | "vencido" | "sin_registro";

export type CuadroRow = {
  departamentoId: string;
  departamento: string;
  familia: string;
  deudaAnterior: boolean;
  meses: Record<number, CellState>;
};

function cellClass(state: CellState) {
  if (state === "pagado") {
    return "bg-cyan-500/30 text-cyan-50 ring-cyan-300/40 print:bg-white print:text-black print:ring-slate-500";
  }
  if (state === "pendiente") {
    return "bg-amber-500/25 text-amber-50 ring-amber-300/40 print:bg-white print:text-black print:ring-slate-500";
  }
  if (state === "vencido") {
    return "bg-red-500/30 text-red-50 ring-red-300/40 print:bg-white print:text-black print:ring-slate-500";
  }
  return "bg-white/5 text-slate-300 ring-white/10 print:bg-white print:text-black print:ring-slate-500";
}

function cellLabel(state: CellState) {
  if (state === "pagado") return "OK";
  if (state === "pendiente") return "Pend";
  if (state === "vencido") return "Venc";
  return "-";
}

const MONTHS = [
  { value: 1, label: "Ene" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dic" },
];

export default function CuadroVitrina({
  title,
  subtitle,
  year,
  rows,
  highlightDepartamentoId,
}: {
  title: string;
  subtitle: string;
  year: number;
  rows: CuadroRow[];
  highlightDepartamentoId?: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-[30px] bg-[#213b59] shadow-xl ring-1 ring-white/10 print:rounded-none print:bg-white print:shadow-none print:ring-0">
      <div className="border-b border-white/10 px-5 py-4 md:px-6 print:border-slate-300 print:px-0 print:py-3">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300 print:text-slate-600">
          Control de mantenimiento
        </p>
        <h2 className="mt-2 text-2xl font-bold text-white print:text-black">{title}</h2>
        <p className="mt-1 text-sm text-slate-300 print:text-slate-700">{subtitle}</p>
      </div>

      <div className="hide-scrollbar overflow-x-auto p-4 md:p-5 print:overflow-visible print:p-0">
        <table className="min-w-[980px] table-fixed border-separate border-spacing-0 print:min-w-0 print:w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[86px] border border-white/20 bg-[#1a334f] px-2 py-2 text-left text-xs font-bold uppercase tracking-[0.18em] text-cyan-200 print:static print:border-slate-500 print:bg-white print:text-black">
                Depto
              </th>
              <th className="sticky left-[86px] z-10 w-[190px] border border-white/20 bg-[#1a334f] px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.18em] text-cyan-200 print:static print:border-slate-500 print:bg-white print:text-black">
                Familia
              </th>
              <th className="w-[80px] border border-white/20 bg-[#415c2b] px-2 py-2 text-center text-xs font-bold uppercase tracking-[0.18em] text-lime-100 print:border-slate-500 print:bg-white print:text-black">
                Prev
              </th>
              {MONTHS.map((month) => (
                <th
                  key={month.value}
                  className="w-[68px] border border-white/20 bg-[#415c2b] px-1 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-lime-100 print:border-slate-500 print:bg-white print:text-black"
                >
                  {month.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const highlighted = highlightDepartamentoId && row.departamentoId === highlightDepartamentoId;
              return (
                <tr key={row.departamentoId} className={highlighted ? "ring-2 ring-orange-300/60" : ""}>
                  <td className="sticky left-0 z-10 border border-white/15 bg-[#223f5f] px-2 py-2 text-lg font-extrabold text-cyan-100 print:static print:border-slate-500 print:bg-white print:text-black">
                    {row.departamento}
                  </td>
                  <td className="sticky left-[86px] z-10 border border-white/15 bg-[#223f5f] px-3 py-2 text-sm font-semibold text-white print:static print:border-slate-500 print:bg-white print:text-black">
                    {row.familia}
                  </td>
                  <td className="border border-white/15 bg-[#2d4a6c] px-1 py-2 text-center print:border-slate-500 print:bg-white">
                    <span
                      className={`inline-flex min-h-[28px] min-w-[56px] items-center justify-center rounded-md px-2 text-[11px] font-bold ring-1 ${
                        row.deudaAnterior
                          ? "bg-red-500/30 text-red-50 ring-red-300/40 print:bg-white print:text-black print:ring-slate-500"
                          : "bg-emerald-500/25 text-emerald-50 ring-emerald-300/40 print:bg-white print:text-black print:ring-slate-500"
                      }`}
                    >
                      {row.deudaAnterior ? "Deuda" : "OK"}
                    </span>
                  </td>
                  {MONTHS.map((month) => {
                    const state = row.meses[month.value] ?? "sin_registro";
                    return (
                      <td
                        key={month.value}
                        className="border border-white/15 bg-[#2d4a6c] px-1 py-2 text-center print:border-slate-500 print:bg-white"
                      >
                        <span
                          className={`inline-flex min-h-[28px] min-w-[50px] items-center justify-center rounded-md px-2 text-[11px] font-bold ring-1 ${cellClass(
                            state
                          )}`}
                        >
                          {cellLabel(state)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-300 md:px-6 print:border-slate-300 print:px-0 print:text-slate-700">
        <p>
          Gestion {year} · Leyenda: <span className="font-bold text-cyan-100 print:text-black">OK</span> = pagado,{" "}
          <span className="font-bold text-amber-100 print:text-black">Pend</span> = pendiente,{" "}
          <span className="font-bold text-red-100 print:text-black">Venc</span> = vencido.
        </p>
      </div>
    </section>
  );
}
