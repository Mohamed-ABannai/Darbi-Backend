const {
  COLORS,
  FONT_SIZES,
  SPACING,
  drawDocumentHeader,
  drawSectionHeading,
  drawStatusBadge,
  statusBadgeWidth,
  ensureSpace,
  formatDate,
  formatMoney,
  addPageFooters
} = require("./pdfStyles");

function drawPartyCard(doc, x, y, width, heading, name) {
  const cardHeight = 68;
  doc.roundedRect(x, y, width, cardHeight, 8).fill(COLORS.lightBlue);
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.muted).text(heading.toUpperCase(), x + SPACING.cardPadding, y + 13);
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.body).fillColor(COLORS.navy).text(name || "Not available", x + SPACING.cardPadding, y + 31, { width: width - SPACING.cardPadding * 2, height: 27, ellipsis: true });
}

function drawTableHeader(doc, x, y, widths) {
  const height = 32;
  doc.roundedRect(x, y, widths.reduce((total, width) => total + width, 0), height, 5).fill(COLORS.navy);
  const labels = ["LESSON", "HOURS", "RATE", "AMOUNT"];
  let columnX = x;
  labels.forEach((label, index) => {
    doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.white).text(label, columnX + 9, y + 11, { width: widths[index] - 18, align: index === 0 ? "left" : "right" });
    columnX += widths[index];
  });
  return height;
}

function drawLessonRow(doc, x, y, widths, values) {
  const descriptionWidth = widths[0] - 18;
  doc.font("Helvetica").fontSize(FONT_SIZES.body);
  const descriptionHeight = doc.heightOfString(values.description, { width: descriptionWidth, lineGap: 2 });
  const rowHeight = Math.max(46, descriptionHeight + 22);
  const totalWidth = widths.reduce((total, width) => total + width, 0);
  doc.roundedRect(x, y, totalWidth, rowHeight, 5).lineWidth(1).strokeColor(COLORS.border).stroke();

  let columnX = x;
  doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.text).text(values.description, columnX + 9, y + 12, { width: descriptionWidth, lineGap: 2 });
  columnX += widths[0];
  [values.hours, values.rate, values.amount].forEach((value, index) => {
    doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.text).text(value, columnX + 5, y + 15, { width: widths[index + 1] - 14, align: "right" });
    columnX += widths[index + 1];
  });
  return rowHeight;
}

function createInvoicePdf(doc, { invoice, payment, lesson, learner, instructor }) {
  const reference = invoice._id.toString();
  const title = "PAYMENT INVOICE";
  const left = SPACING.pageMargin;
  const contentWidth = doc.page.width - left * 2;

  drawDocumentHeader(doc, title, reference);
  const paidBadgeWidth = statusBadgeWidth(doc, "PAID");
  const paidBadgeX = doc.page.width - left - paidBadgeWidth;
  drawStatusBadge(doc, "PAID", paidBadgeX, doc.y - 3);
  doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.muted).text("Payment confirmed", left, doc.y + 3);
  doc.y += 32;

  drawSectionHeading(doc, "Invoice details", title, reference);
  const detailY = doc.y;
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.muted).text("INVOICE NUMBER", left, detailY);
  doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.text).text(reference, left, detailY + 15, { width: contentWidth / 2 - 16 });
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.muted).text("ISSUED", left + contentWidth / 2, detailY);
  doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.text).text(formatDate(invoice.date), left + contentWidth / 2, detailY + 15);
  doc.y = detailY + 43;

  drawSectionHeading(doc, "Invoice parties", title, reference);
  const gap = 12;
  const cardWidth = (contentWidth - gap) / 2;
  ensureSpace(doc, 78, title, reference);
  drawPartyCard(doc, left, doc.y, cardWidth, "Bill to", learner?.username);
  drawPartyCard(doc, left + cardWidth + gap, doc.y, cardWidth, "Driving instructor", instructor?.username);
  doc.y += 84;

  drawSectionHeading(doc, "Lesson charge", title, reference);
  const hours = Number(lesson.hours || 0);
  const amount = Number(invoice.amount ?? payment.amount ?? 0);
  const rate = Number(lesson.hourlyRateSnapshot || lesson.hourlyRate || (hours ? amount / hours : 0));
  const widths = [contentWidth - 232, 58, 82, 92];
  const description = `Completed driving lesson · ${formatDate(lesson.date)}`;
  doc.font("Helvetica").fontSize(FONT_SIZES.body);
  const descriptionHeight = doc.heightOfString(description, { width: widths[0] - 18, lineGap: 2 });
  const rowHeight = Math.max(46, descriptionHeight + 22);
  ensureSpace(doc, 40 + rowHeight + 22, title, reference);
  const headerHeight = drawTableHeader(doc, left, doc.y, widths);
  doc.y += headerHeight + 6;
  const drawnRowHeight = drawLessonRow(doc, left, doc.y, widths, {
    description,
    hours: `${hours} hrs`,
    rate: formatMoney(rate),
    amount: formatMoney(amount)
  });
  doc.y += drawnRowHeight + SPACING.sectionGap;

  ensureSpace(doc, 94, title, reference);
  const totalY = doc.y;
  doc.roundedRect(left, totalY, contentWidth, 72, 8).fill(COLORS.lightBlue);
  doc.rect(left, totalY, 5, 72).fill(COLORS.red);
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.muted).text("TOTAL PAID", left + 18, totalY + 17);
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.total).fillColor(COLORS.navy).text(formatMoney(amount), left + 18, totalY + 34);
  const confirmedWidth = statusBadgeWidth(doc, "CONFIRMED");
  drawStatusBadge(doc, "CONFIRMED", doc.page.width - left - confirmedWidth, totalY + 25, COLORS.navy);
  doc.y = totalY + 92;

  drawSectionHeading(doc, "Payment details", title, reference);
  const paymentY = doc.y;
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.muted).text("PAYMENT METHOD", left, paymentY);
  doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.text).text(payment.method || "Not recorded", left, paymentY + 15);
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.muted).text("PAYMENT DATE", left + contentWidth / 2, paymentY);
  doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.text).text(formatDate(invoice.date), left + contentWidth / 2, paymentY + 15);

  addPageFooters(doc);
  return { amount, pages: doc.bufferedPageRange().count };
}

module.exports = createInvoicePdf;
