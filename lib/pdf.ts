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

// Same landscape proportion as the provided reference PDF.
const PAGE_WIDTH = 421;
const PAGE_HEIGHT = 298;

const WHITE: Rgb = [1, 1, 1];
const NAVY_900: Rgb = [0.04, 0.12, 0.25];
const NAVY_700: Rgb = [0.11, 0.22, 0.4];
const SLATE_900: Rgb = [0.12, 0.14, 0.18];
const SLATE_600: Rgb = [0.39, 0.43, 0.49];
const SLATE_300: Rgb = [0.79, 0.82, 0.86];
const SLATE_200: Rgb = [0.89, 0.91, 0.94];
const CYAN_600: Rgb = [0.05, 0.55, 0.68];
const ORANGE_500: Rgb = [0.95, 0.44, 0.18];

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
  return Number(num)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)$/, "$10");
}

function setFillColor([r, g, b]: Rgb) {
  return `${fmt(r)} ${fmt(g)} ${fmt(b)} rg`;
}

function setStrokeColor([r, g, b]: Rgb) {
  return `${fmt(r)} ${fmt(g)} ${fmt(b)} RG`;
}

function renderOp(op: PdfOp) {
  if (op.type === "text") {
    const color = setFillColor(op.color || SLATE_900);
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
      setStrokeColor(op.color || SLATE_300),
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
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
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
  color: Rgb = SLATE_900
) {
  ops.push({ type: "text", x, y, size, value, bold, color });
}

function yTop(topOffset: number) {
  return PAGE_HEIGHT - topOffset;
}

function addField(
  ops: PdfOp[],
  label: string,
  value: string,
  x: number,
  y: number,
  max: number
) {
  addText(ops, `${label}:`, x, y, 7.5, true, SLATE_600);
  addText(ops, truncate(value, max), x, y - 12, 9.5, false, SLATE_900);
}

export function buildReceiptPdf(data: ReceiptPdfData) {
  const ops: PdfOp[] = [];
  const margin = 16;
  const innerW = PAGE_WIDTH - margin * 2;

  const receiptNumber = truncate(data.receiptNumber, 18);
  const fechaLabel = truncate(data.fechaLabel, 28);
  const vecinoName = truncate(data.vecinoName, 36);
  const departamentoLabel = truncate(data.departamentoLabel, 16);
  const bloqueLabel = truncate(`${data.bloqueName} (${data.bloqueCode})`, 34);
  const periodoLabel = truncate(data.periodoLabel, 18);
  const montoLabel = truncate(data.montoLabel, 16);
  const referenciaLabel = truncate(data.referenciaLabel, 28);
  const metodoLabel = truncate(data.metodoLabel, 20);
  const observacionesLabel = truncate(data.observacionesLabel, 56);
  const aprobadoPorLabel = truncate(data.aprobadoPorLabel, 26);
  const adminEmailLabel = truncate(data.adminEmailLabel, 32);
  const adminPhoneLabel = truncate(data.adminPhoneLabel, 18);

  // Base surface
  ops.push({
    type: "rect",
    x: margin,
    y: margin,
    w: innerW,
    h: PAGE_HEIGHT - margin * 2,
    stroke: SLATE_300,
    lineWidth: 1,
  });

  // Header
  const headerH = 56;
  ops.push({
    type: "rect",
    x: margin,
    y: PAGE_HEIGHT - margin - headerH,
    w: innerW,
    h: headerH,
    fill: NAVY_900,
  });

  addText(ops, "MIBLOQUE", margin + 14, yTop(28), 12, true, WHITE);
  addText(ops, "Recibo oficial de pago", margin + 14, yTop(43), 8.2, false, SLATE_200);
  addText(ops, "Nro", PAGE_WIDTH - margin - 132, yTop(26), 8, true, SLATE_200);
  addText(ops, receiptNumber, PAGE_WIDTH - margin - 106, yTop(26), 12, true, WHITE);
  addText(ops, "Fecha", PAGE_WIDTH - margin - 132, yTop(42), 8, true, SLATE_200);
  addText(ops, fechaLabel, PAGE_WIDTH - margin - 106, yTop(42), 8.8, false, WHITE);

  // Identity cards
  const cardY = PAGE_HEIGHT - margin - headerH - 76;
  const cardH = 62;
  const cardGap = 10;
  const cardW = (innerW - cardGap) / 2;

  ops.push({
    type: "rect",
    x: margin,
    y: cardY,
    w: cardW,
    h: cardH,
    fill: SLATE_200,
    stroke: SLATE_300,
  });

  ops.push({
    type: "rect",
    x: margin + cardW + cardGap,
    y: cardY,
    w: cardW,
    h: cardH,
    fill: SLATE_200,
    stroke: SLATE_300,
  });

  addText(ops, "RECIBIDO DE", margin + 10, cardY + cardH - 14, 7.4, true, SLATE_600);
  addText(ops, vecinoName, margin + 10, cardY + cardH - 30, 11, true, SLATE_900);
  addText(
    ops,
    `Depto ${departamentoLabel} - ${bloqueLabel}`,
    margin + 10,
    cardY + cardH - 45,
    8.2,
    false,
    SLATE_600
  );

  const rightCardX = margin + cardW + cardGap;
  addText(ops, "DETALLE DE PAGO", rightCardX + 10, cardY + cardH - 14, 7.4, true, SLATE_600);
  addText(ops, `Periodo: ${periodoLabel}`, rightCardX + 10, cardY + cardH - 30, 9.4, true, SLATE_900);
  addText(
    ops,
    `Metodo: ${metodoLabel} - Ref: ${referenciaLabel}`,
    rightCardX + 10,
    cardY + cardH - 45,
    8.2,
    false,
    SLATE_600
  );

  // Amount highlight
  const amountY = cardY - 50;
  ops.push({
    type: "rect",
    x: margin,
    y: amountY,
    w: innerW,
    h: 40,
    fill: CYAN_600,
  });
  addText(ops, "TOTAL PAGADO", margin + 12, amountY + 25, 9, true, WHITE);
  addText(ops, montoLabel, PAGE_WIDTH - margin - 92, amountY + 22, 16, true, WHITE);

  // Metadata rows
  const metaStartY = amountY - 18;
  addField(ops, "Aprobado por", aprobadoPorLabel, margin + 2, metaStartY, 28);
  addField(ops, "Telefono admin", adminPhoneLabel, margin + 122, metaStartY, 20);
  addField(ops, "Correo admin", adminEmailLabel, margin + 230, metaStartY, 34);

  addField(ops, "Observaciones", observacionesLabel, margin + 2, metaStartY - 30, 64);

  // Footer
  const footerY = margin + 8;
  ops.push({
    type: "line",
    x1: margin,
    y1: footerY + 26,
    x2: PAGE_WIDTH - margin,
    y2: footerY + 26,
    width: 1,
    color: SLATE_300,
  });

  addText(
    ops,
    "Este recibo certifica un pago validado por la administracion del bloque.",
    margin + 2,
    footerY + 12,
    7.5,
    false,
    SLATE_600
  );
  addText(ops, "MiBloque", PAGE_WIDTH - margin - 52, footerY + 12, 8, true, NAVY_700);

  // Accent marks
  ops.push({
    type: "rect",
    x: margin,
    y: PAGE_HEIGHT - margin - headerH,
    w: 6,
    h: headerH,
    fill: ORANGE_500,
  });
  ops.push({
    type: "rect",
    x: PAGE_WIDTH - margin - 6,
    y: PAGE_HEIGHT - margin - headerH,
    w: 6,
    h: headerH,
    fill: ORANGE_500,
  });

  const stream = ops.map(renderOp).join("\n");
  return createPdf(stream);
}
