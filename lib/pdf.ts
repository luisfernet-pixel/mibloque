type Rgb = [number, number, number];

export type ReceiptPdfData = {
  receiptNumber: string;
  fechaLabel: string;
  vecinoName: string;
  departamentoLabel: string;
  bloqueName: string;
  bloqueCode: string;
  periodoLabel: string;
  montoLabel: string;
  referenciaLabel: string;
  metodoLabel: string;
  observacionesLabel: string;
  aprobadoPorLabel: string;
  adminEmailLabel: string;
  adminPhoneLabel: string;
};

type TextOp = {
  type: "text";
  x: number;
  y: number;
  size: number;
  value: string;
  bold?: boolean;
  color?: Rgb;
};

type LineOp = {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width?: number;
  color?: Rgb;
};

type RectOp = {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: Rgb;
  stroke?: Rgb;
  lineWidth?: number;
};

type PdfOp = TextOp | LineOp | RectOp;

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

const NAVY: Rgb = [0.07, 0.19, 0.39];
const RED: Rgb = [0.78, 0.15, 0.14];
const TEXT: Rgb = [0.1, 0.1, 0.1];
const MUTED: Rgb = [0.45, 0.48, 0.52];
const LIGHT_LINE: Rgb = [0.72, 0.74, 0.78];
const LIGHT_FILL: Rgb = [0.96, 0.97, 0.99];

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapePdfText(value: string) {
  return stripDiacritics(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncate(value: string, maxLength: number) {
  const clean = stripDiacritics(value || "").trim();
  if (!clean) return "-";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function fmt(num: number) {
  return Number(num).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)$/, "$10");
}

function setFillColor([r, g, b]: Rgb) {
  return `${fmt(r)} ${fmt(g)} ${fmt(b)} rg`;
}

function setStrokeColor([r, g, b]: Rgb) {
  return `${fmt(r)} ${fmt(g)} ${fmt(b)} RG`;
}

function renderOp(op: PdfOp) {
  if (op.type === "text") {
    const color = setFillColor(op.color || TEXT);
    const font = op.bold ? "/F2" : "/F1";
    return [
      "BT",
      color,
      `${font} ${fmt(op.size)} Tf`,
      `1 0 0 1 ${fmt(op.x)} ${fmt(op.y)} Tm`,
      `(${escapePdfText(op.value)}) Tj`,
      "ET",
    ].join("\n");
  }

  if (op.type === "line") {
    return [
      setStrokeColor(op.color || LIGHT_LINE),
      `${fmt(op.width || 1)} w`,
      `${fmt(op.x1)} ${fmt(op.y1)} m`,
      `${fmt(op.x2)} ${fmt(op.y2)} l`,
      "S",
    ].join("\n");
  }

  const bits: string[] = [];
  if (op.fill) bits.push(setFillColor(op.fill));
  if (op.stroke) bits.push(setStrokeColor(op.stroke));
  bits.push(`${fmt(op.lineWidth || 1)} w`);
  bits.push(`${fmt(op.x)} ${fmt(op.y)} ${fmt(op.w)} ${fmt(op.h)} re`);
  if (op.fill && op.stroke) bits.push("B");
  else if (op.fill) bits.push("f");
  else bits.push("S");
  return bits.join("\n");
}

function createPdf(content: string) {
  const encoder = new TextEncoder();
  const contentBytes = encoder.encode(content);
  const contentLength = contentBytes.length;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count 1 /Kids [3 0 R] >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(pdf);
}

function addText(
  ops: PdfOp[],
  value: string,
  x: number,
  y: number,
  size: number,
  bold = false,
  color: Rgb = TEXT
) {
  ops.push({
    type: "text",
    x,
    y,
    size,
    value,
    bold,
    color,
  });
}

export function buildReceiptPdf(data: ReceiptPdfData) {
  const ops: PdfOp[] = [];

  const receiptNumber = truncate(data.receiptNumber, 18);
  const fechaLabel = truncate(data.fechaLabel, 26);
  const vecinoName = truncate(data.vecinoName, 26);
  const departamentoLabel = truncate(data.departamentoLabel, 14);
  const bloqueLabel = truncate(`${data.bloqueName} (${data.bloqueCode})`, 28);
  const periodoLabel = truncate(data.periodoLabel, 16);
  const montoLabel = truncate(data.montoLabel, 14);
  const referenciaLabel = truncate(data.referenciaLabel, 16);
  const metodoLabel = truncate(data.metodoLabel, 18);
  const observacionesLabel = truncate(data.observacionesLabel, 32);
  const aprobadoPorLabel = truncate(data.aprobadoPorLabel, 22);
  const adminEmailLabel = truncate(data.adminEmailLabel, 22);
  const adminPhoneLabel = truncate(data.adminPhoneLabel, 16);

  ops.push({
    type: "rect",
    x: 36,
    y: 470,
    w: 523,
    h: 322,
    stroke: LIGHT_LINE,
    lineWidth: 1,
  });

  addText(ops, "MIBLOQUE", 54, 770, 10, true, NAVY);
  addText(ops, "ADMINISTRACION", 54, 746, 17, true, NAVY);
  addText(ops, "DEL EDIFICIO", 54, 724, 17, true, NAVY);
  addText(ops, "Administramos para tu tranquilidad", 54, 704, 8.5, false, TEXT);

  ops.push({
    type: "line",
    x1: 290,
    y1: 704,
    x2: 290,
    y2: 782,
    width: 1,
    color: LIGHT_LINE,
  });

  addText(ops, "RECIBO DE PAGO", 338, 748, 19, true, NAVY);
  addText(ops, "Nro.", 430, 714, 12, true, NAVY);
  addText(ops, receiptNumber, 462, 714, 14, true, RED);
  addText(ops, "Fecha:", 392, 680, 10, true, NAVY);
  addText(ops, fechaLabel, 430, 680, 10, false, TEXT);

  ops.push({
    type: "line",
    x1: 54,
    y1: 662,
    x2: 535,
    y2: 662,
    width: 1.4,
    color: NAVY,
  });

  addText(
    ops,
    "Por medio del presente, se hace constar que se ha recibido el pago con los siguientes detalles:",
    54,
    626,
    9,
    false,
    TEXT
  );

  addText(ops, "RECIBIDO DE:", 54, 582, 11, true, NAVY);
  addText(ops, "CONCEPTO:", 320, 582, 11, true, NAVY);

  addText(ops, vecinoName, 54, 548, 13, true, TEXT);
  addText(ops, `Apto. ${departamentoLabel}`, 54, 526, 9, false, TEXT);
  addText(ops, bloqueLabel, 54, 510, 8, false, MUTED);

  addText(ops, "Pago de mensualidad de mantenimiento", 320, 548, 11.5, true, TEXT);
  addText(ops, "Correspondiente al mes de:", 320, 526, 8.5, false, TEXT);
  addText(ops, periodoLabel, 456, 526, 9, true, TEXT);

  ops.push({
    type: "line",
    x1: 54,
    y1: 488,
    x2: 535,
    y2: 488,
    width: 1,
    color: LIGHT_LINE,
  });

  ops.push({
    type: "rect",
    x: 54,
    y: 442,
    w: 254,
    h: 24,
    fill: NAVY,
  });
  addText(ops, "DETALLE", 72, 450, 11, true, [1, 1, 1]);
  addText(ops, "MONTO", 228, 450, 11, true, [1, 1, 1]);

  ops.push({
    type: "rect",
    x: 54,
    y: 360,
    w: 254,
    h: 82,
    stroke: LIGHT_LINE,
    lineWidth: 1,
  });
  ops.push({
    type: "line",
    x1: 224,
    y1: 360,
    x2: 224,
    y2: 442,
    width: 1,
    color: LIGHT_LINE,
  });
  ops.push({
    type: "line",
    x1: 54,
    y1: 414,
    x2: 308,
    y2: 414,
    width: 1,
    color: LIGHT_LINE,
  });
  ops.push({
    type: "line",
    x1: 54,
    y1: 387,
    x2: 308,
    y2: 387,
    width: 1,
    color: LIGHT_LINE,
  });
  ops.push({
    type: "rect",
    x: 54,
    y: 360,
    w: 254,
    h: 27,
    fill: LIGHT_FILL,
  });
  ops.push({
    type: "line",
    x1: 54,
    y1: 387,
    x2: 308,
    y2: 387,
    width: 1,
    color: LIGHT_LINE,
  });

  addText(ops, `Cuota de mantenimiento (${periodoLabel})`, 64, 397, 7.5, false, TEXT);
  addText(ops, montoLabel, 266, 397, 8.5, false, TEXT);
  addText(ops, "Otros cargos / ajustes", 64, 370, 8, false, TEXT);
  addText(ops, "Bs 0.00", 265, 370, 8.5, false, TEXT);
  addText(ops, "TOTAL PAGADO", 72, 343, 10.5, true, NAVY);
  addText(ops, montoLabel, 258, 343, 10.5, true, NAVY);

  addText(ops, "FORMA DE PAGO:", 320, 442, 11, true, NAVY);
  addText(ops, metodoLabel, 320, 414, 10, false, TEXT);
  ops.push({
    type: "line",
    x1: 320,
    y1: 394,
    x2: 500,
    y2: 394,
    width: 1,
    color: LIGHT_LINE,
  });

  addText(ops, "RECIBIDO POR:", 320, 362, 11, true, NAVY);
  addText(ops, aprobadoPorLabel, 320, 334, 10, false, TEXT);
  addText(ops, "Firma y sello", 405, 286, 9, false, TEXT);
  ops.push({
    type: "line",
    x1: 390,
    y1: 304,
    x2: 500,
    y2: 304,
    width: 1.1,
    color: TEXT,
  });

  addText(ops, "Monto reportado:", 54, 316, 8.5, true, TEXT);
  addText(ops, montoLabel, 127, 316, 8.5, false, TEXT);
  addText(ops, "Referencia:", 54, 296, 8.5, true, TEXT);
  addText(ops, referenciaLabel, 110, 296, 8.5, false, TEXT);
  addText(ops, "Aprobado:", 54, 276, 8.5, true, TEXT);
  addText(ops, observacionesLabel, 108, 276, 8.5, false, MUTED);

  ops.push({
    type: "line",
    x1: 54,
    y1: 244,
    x2: 535,
    y2: 244,
    width: 1.4,
    color: NAVY,
  });

  addText(
    ops,
    "Gracias por contribuir al bienestar de nuestra comunidad.",
    54,
    212,
    8.5,
    false,
    NAVY
  );
  addText(ops, "Telefono:", 300, 212, 8.5, true, NAVY);
  addText(ops, adminPhoneLabel, 352, 212, 8.5, false, TEXT);
  addText(ops, "Correo:", 300, 194, 8.5, true, NAVY);
  addText(ops, adminEmailLabel, 345, 194, 8.5, false, TEXT);

  addText(
    ops,
    "Este documento respalda el pago aprobado por la administracion.",
    54,
    170,
    7.5,
    false,
    MUTED
  );

  const stream = ops.map(renderOp).join("\n");
  return createPdf(stream);
}
