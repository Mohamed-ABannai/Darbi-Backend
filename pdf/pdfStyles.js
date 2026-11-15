const path = require("path");

const COLORS = {
  navy: "#142e42",
  red: "#d52f48",
  white: "#ffffff",
  lightBlue: "#eaf3f8",
  midBlue: "#b9d2e1",
  text: "#243746",
  muted: "#637887",
  border: "#d8e3ea"
};

const FONT_SIZES = {
  small: 8,
  body: 10,
  label: 8,
  section: 11,
  title: 20,
  total: 17
};

const SPACING = {
  pageMargin: 48,
  sectionGap: 24,
  cardPadding: 14,
  tablePadding: 10,
  footerHeight: 48
};

const LOGO_PATH = path.join(__dirname, "..", "assets", "darbi-logo.png");

function drawDocumentHeader(doc, title, reference) {
  const pageWidth = doc.page.width;
  doc.rect(0, 0, pageWidth, 132).fill(COLORS.navy);
  doc.rect(0, 0, pageWidth, 6).fill(COLORS.red);
  doc.roundedRect(42, 28, 68, 68, 10).fill(COLORS.white);
  doc.image(LOGO_PATH, 48, 34, { fit: [56, 56], align: "center", valign: "center" });

  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(FONT_SIZES.small).text("DARBI", 126, 32);
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.title).text(title, 126, 49, { width: 270 });
  doc.font("Helvetica").fontSize(FONT_SIZES.body).fillColor(COLORS.midBlue).text("Driving forward with confidence", 126, 81);

  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.label).fillColor(COLORS.midBlue).text("REFERENCE", pageWidth - 190, 36, { width: 148, align: "right" });
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.body).fillColor(COLORS.white).text(String(reference), pageWidth - 205, 53, { width: 163, align: "right" });
  doc.y = 158;
}

function addContinuationPage(doc, title, reference) {
  doc.addPage();
  doc.rect(0, 0, doc.page.width, 8).fill(COLORS.red);
  doc.rect(0, 8, doc.page.width, 74).fill(COLORS.navy);
  doc.roundedRect(42, 20, 50, 50, 8).fill(COLORS.white);
  doc.image(LOGO_PATH, 47, 25, { fit: [40, 40], align: "center", valign: "center" });
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.section).fillColor(COLORS.white).text(title, 108, 28);
  doc.font("Helvetica").fontSize(FONT_SIZES.small).fillColor(COLORS.midBlue).text(`Reference ${reference}`, 108, 48);
  doc.y = 104;
}

function ensureSpace(doc, height, title, reference) {
  const bottomLimit = doc.page.height - SPACING.footerHeight - SPACING.pageMargin;
  if (doc.y + height > bottomLimit) {
    addContinuationPage(doc, title, reference);
  }
}

function drawSectionHeading(doc, text, title, reference) {
  ensureSpace(doc, 38, title, reference);
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.section).fillColor(COLORS.navy).text(text.toUpperCase(), SPACING.pageMargin, doc.y);
  doc.moveTo(SPACING.pageMargin, doc.y + 19).lineTo(doc.page.width - SPACING.pageMargin, doc.y + 19).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.y += 30;
}

function drawStatusBadge(doc, text, x, y, background = COLORS.red) {
  const label = String(text).toUpperCase();
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.small);
  const width = statusBadgeWidth(doc, label);
  doc.roundedRect(x, y, width, 22, 7).fill(background);
  doc.fillColor(COLORS.white).text(label, x + 10, y + 7, { lineBreak: false });
  return width;
}

function statusBadgeWidth(doc, text) {
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.small);
  return doc.widthOfString(String(text).toUpperCase()) + 20;
}

function drawFooter(doc, pageNumber, pageCount) {
  const y = doc.page.height - SPACING.pageMargin - SPACING.footerHeight;
  doc.moveTo(SPACING.pageMargin, y).lineTo(doc.page.width - SPACING.pageMargin, y).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.font("Helvetica").fontSize(FONT_SIZES.small).fillColor(COLORS.muted).text("DARBI  ·  Thank you for choosing us for your driving journey.", SPACING.pageMargin, y + 8, { width: 360, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.small).fillColor(COLORS.navy).text(`Page ${pageNumber} of ${pageCount}`, doc.page.width - 130, y + 8, { width: 82, align: "right", lineBreak: false });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleDateString("en-BH", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(3)} BHD`;
}

function addPageFooters(doc) {
  const pageRange = doc.bufferedPageRange();
  for (let index = pageRange.start; index < pageRange.start + pageRange.count; index++) {
    doc.switchToPage(index);
    drawFooter(doc, index + 1, pageRange.count);
  }
  doc.switchToPage(pageRange.start + pageRange.count - 1);
}

module.exports = {
  COLORS,
  FONT_SIZES,
  SPACING,
  LOGO_PATH,
  drawDocumentHeader,
  drawSectionHeading,
  drawStatusBadge,
  statusBadgeWidth,
  ensureSpace,
  formatDate,
  formatMoney,
  addPageFooters
};
