// ===================== Exportación de notas de venta =====================
// PDF con jsPDF + autoTable · Excel (.xlsx) con SheetJS.
// Las funciones se invocan solo en cliente (desde componentes "use client").

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Order,
  fmtDate,
  fmtDateTime,
  itemTotal,
  orderDiscount,
  orderItemCount,
  orderSubtotal,
  orderTotal,
  statusLabel,
} from "@/lib/adminData";
import { bs2 } from "@/lib/products";

const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}${d.getDate().toString().padStart(2, "0")}`;
};

const BRAND: [number, number, number] = [177, 30, 75]; // rose #B11E4B
const INK: [number, number, number] = [36, 26, 30];

// --------------------------------------------------------------------------
// Listado de notas de venta → PDF
// --------------------------------------------------------------------------
export function exportOrdersPDF(orders: Order[], businessName = "Notas de venta") {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setTextColor(...BRAND);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${businessName} · Notas de venta`, 40, 40);

  doc.setTextColor(120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Generado el ${fmtDateTime(new Date())} · ${orders.length} nota(s)`,
    40,
    56
  );

  autoTable(doc, {
    startY: 70,
    head: [
      [
        "N° Nota",
        "Fecha",
        "Cliente",
        "Entrega",
        "Estado",
        "Pago",
        "Vendedor",
        "Ítems",
        "Total (Bs)",
      ],
    ],
    body: orders.map((o) => [
      o.code,
      fmtDate(o.createdAt),
      o.clientName,
      `${fmtDate(o.deliveryDate)} ${o.deliveryTime}`,
      statusLabel(o.status),
      o.payMethod,
      o.createdBy,
      String(orderItemCount(o)),
      orderTotal(o).toFixed(2),
    ]),
    styles: { fontSize: 8.5, cellPadding: 5, textColor: INK },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [251, 246, 240] },
    columnStyles: { 8: { halign: "right" } },
  });

  const total = orders.reduce((s, o) => s + orderTotal(o), 0);
  const y = (doc as any).lastAutoTable.finalY + 20;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total general: ${bs2(total)}`, 40, y);

  doc.save(`notas-venta-${stamp()}.pdf`);
}

// --------------------------------------------------------------------------
// Listado de notas de venta → Excel (.xlsx)
// --------------------------------------------------------------------------
export function exportOrdersExcel(orders: Order[]) {
  const rows = orders.map((o) => ({
    "N° Nota": o.code,
    "Fecha creación": fmtDate(o.createdAt),
    Cliente: o.clientName,
    Teléfono: o.phone,
    "Fecha entrega": fmtDate(o.deliveryDate),
    "Hora entrega": o.deliveryTime,
    Dirección: o.address,
    Estado: statusLabel(o.status),
    "Método de pago": o.payMethod,
    Vendedor: o.createdBy,
    Ítems: orderItemCount(o),
    Subtotal: orderSubtotal(o),
    Descuento: orderDiscount(o),
    "Costo entrega": o.deliveryCost,
    Total: orderTotal(o),
    Observaciones: o.orderNotes,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
    { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Notas de venta");
  XLSX.writeFile(wb, `notas-venta-${stamp()}.xlsx`);
}

// --------------------------------------------------------------------------
// Una nota de venta individual → PDF con detalle (comprobante)
// --------------------------------------------------------------------------
export function exportNotaPDF(o: Order, businessName = "") {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;

  doc.setTextColor(...BRAND);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(businessName, M, 46);

  doc.setTextColor(...INK);
  doc.setFontSize(13);
  doc.text("NOTA DE VENTA", 555, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`N° ${o.code}`, 555, 56, { align: "right" });
  doc.text(`Fecha: ${fmtDate(o.createdAt)}`, 555, 70, { align: "right" });
  doc.text(`Estado: ${statusLabel(o.status)}`, 555, 84, { align: "right" });

  // Datos del cliente y entrega
  doc.setDrawColor(231, 221, 210);
  doc.line(M, 98, 555, 98);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Cliente", M, 118);
  doc.text("Entrega", 310, 118);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90);

  const clientLines = [
    o.clientName,
    o.phone && `Tel: ${o.phone}`,
    o.address,
    o.reference,
  ].filter(Boolean) as string[];
  clientLines.forEach((t, i) => doc.text(t, M, 134 + i * 14));

  const deliveryLines = [
    `${fmtDate(o.deliveryDate)} · ${o.deliveryTime}`,
    o.courier && `Repartidor: ${o.courier}`,
    `Pago: ${o.payMethod}${o.needsReceipt ? " (con comprobante)" : ""}`,
    `Vendedor: ${o.createdBy}`,
  ].filter(Boolean) as string[];
  deliveryLines.forEach((t, i) => doc.text(t, 310, 134 + i * 14));

  const startY = 134 + Math.max(clientLines.length, deliveryLines.length) * 14 + 12;

  autoTable(doc, {
    startY,
    head: [["Producto", "Detalle", "Cant.", "P. Unit.", "Desc.%", "Subtotal"]],
    body: o.items.map((it) => [
      it.name,
      it.detail || "—",
      String(it.qty),
      bs2(it.unitPrice),
      `${it.discountPct}%`,
      bs2(itemTotal(it)),
    ]),
    styles: { fontSize: 9, cellPadding: 5, textColor: INK },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [251, 246, 240] },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "center" },
      5: { halign: "right" },
    },
  });

  let y = (doc as any).lastAutoTable.finalY + 16;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(bold ? BRAND : INK));
    doc.text(label, 380, y, { align: "right" });
    doc.text(value, 555, y, { align: "right" });
    y += bold ? 20 : 16;
  };
  row("Subtotal", bs2(orderSubtotal(o)));
  row("Descuento", `- ${bs2(orderDiscount(o))}`);
  row("Costo de entrega", bs2(o.deliveryCost));
  row("TOTAL", bs2(orderTotal(o)), true);

  if (o.orderNotes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text("Observaciones", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    doc.text(doc.splitTextToSize(o.orderNotes, 515), M, y + 14);
  }

  doc.save(`nota-${o.code}.pdf`);
}
