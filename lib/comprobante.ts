// Comprobante PDF de una venta: PROFORMA (cotización) o FACTURA (venta).
// Documento interno simple (sin impuestos SIN). Se genera en el cliente al
// cobrar/cotizar en el POS. jsPDF + autoTable.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { bs2 } from "./products";
import type { SaleKind, SaleLine } from "./salesClient";

const YELLOW: [number, number, number] = [254, 187, 3]; // #FEBB03
const INK: [number, number, number] = [20, 17, 15]; // #14110F

export interface ComprobanteData {
  code: string;
  kind: SaleKind;
  date: Date;
  business: { name: string; address?: string; phone?: string };
  client: { name: string; nit?: string; phone?: string };
  items: SaleLine[];
  payMethod: string;
  seller: string;
  notes?: string;
}

const money = (n: number) => bs2(n);
const fdate = (d: Date) =>
  `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

/** Genera y descarga el PDF del comprobante. */
export function exportComprobante(data: ComprobanteData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const esFactura = data.kind === "factura";
  const titulo = esFactura ? "FACTURA" : "PROFORMA";

  // ---- Franja superior amarilla con el nombre del negocio ----
  doc.setFillColor(...YELLOW);
  doc.rect(0, 0, 595, 70, "F");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(data.business.name || "Mi negocio", M, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const cab = [data.business.address, data.business.phone].filter(Boolean).join("  ·  ");
  if (cab) doc.text(cab, M, 52);

  // Título del comprobante (derecha)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, 555, 34, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`N° ${data.code}`, 555, 52, { align: "right" });

  // ---- Datos de fecha / cliente ----
  let y = 100;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Cliente", M, y);
  doc.text("Comprobante", 320, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90);

  const cli = [
    data.client.name || "Consumidor final",
    data.client.nit && `NIT/CI: ${data.client.nit}`,
    data.client.phone && `Tel: ${data.client.phone}`,
  ].filter(Boolean) as string[];
  cli.forEach((t, i) => doc.text(t, M, y + 16 + i * 13));

  const meta = [
    `Fecha: ${fdate(data.date)}`,
    `Pago: ${data.payMethod}`,
    `Atendió: ${data.seller || "-"}`,
  ];
  meta.forEach((t, i) => doc.text(t, 320, y + 16 + i * 13));

  // ---- Tabla de ítems ----
  const body = data.items.map((it) => {
    const bruto = it.qty * it.unitPrice;
    const total = bruto * (1 - it.discountPct / 100);
    return [
      it.sku || "-",
      it.name,
      it.qty.toString(),
      money(it.unitPrice),
      it.discountPct ? `${it.discountPct}%` : "-",
      money(total),
    ];
  });

  autoTable(doc, {
    startY: y + 70,
    head: [["SKU", "Descripción", "Cant.", "P. unit.", "Desc.", "Total"]],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: [40, 40, 40] },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70 },
      2: { halign: "center", cellWidth: 44 },
      3: { halign: "right", cellWidth: 75 },
      4: { halign: "center", cellWidth: 50 },
      5: { halign: "right", cellWidth: 80 },
    },
    margin: { left: M, right: M },
  });

  // ---- Totales ----
  const subtotal = data.items.reduce((a, it) => a + it.qty * it.unitPrice, 0);
  const total = data.items.reduce(
    (a, it) => a + it.qty * it.unitPrice * (1 - it.discountPct / 100),
    0
  );
  const descuento = subtotal - total;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ty = (doc as any).lastAutoTable.finalY + 18;
  const line = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...INK);
    doc.text(label, 400, ty, { align: "right" });
    doc.text(value, 555, ty, { align: "right" });
    ty += bold ? 20 : 15;
  };
  line("Subtotal:", money(subtotal));
  if (descuento > 0.005) line("Descuento:", `- ${money(descuento)}`);
  line("TOTAL:", money(total), true);

  // ---- Pie ----
  ty += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120);
  const pie = esFactura
    ? "Gracias por su compra."
    : "Proforma / cotización. No constituye comprobante de venta. Precios sujetos a cambio.";
  doc.text(pie, M, ty);
  if (data.notes) doc.text(data.notes, M, ty + 14);

  doc.save(`${data.code}.pdf`);
}
