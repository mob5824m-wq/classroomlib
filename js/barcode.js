/* ============================================================
 * barcode.js — EAN-13 barcode generator for each book
 * ------------------------------------------------------------
 * Renders a real, scannable EAN-13 barcode to a <canvas>.
 * Use Store to get a book's ISBN and draw it anywhere.
 * ============================================================ */
const Barcode = (function () {
 // EAN-13 encodings: [L, G, R] for digits 0..9
 const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
 const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
 const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
 // Parity patterns for the first digit (digits 2..7)
 const PARITY = [
 "LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG",
 "LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL",
 ];

 // Compute EAN-13 check digit from the first 12 digits.
 function checkDigit(digits) {
 if (digits.length !== 12) return null;
 let sum = 0;
 for (let i = 0; i < 12; i++) {
 const d = parseInt(digits[i], 10);
 sum += i % 2 === 0 ? d : d * 3; // weight 1,3,1,3...
 }
 return (10 - (sum % 10)) % 10;
 }

 // Validate/normalize a 13-digit ISBN into a valid EAN-13 digit string.
 function normalizeEan13(isbn) {
 let digits = String(isbn || "").replace(/[^0-9]/g, "");
 if (digits.length < 12) return null;
 digits = digits.slice(0, 13);
 const first12 = digits.slice(0, 12);
 const cd = checkDigit(first12);
 return first12 + String(cd);
 }

 // Build the full bit pattern (95 modules) for an EAN-13.
 function buildPattern(ean13) {
 const parity = PARITY[parseInt(ean13[0], 10)];
 let bits = "101"; // start guard
 // left half: digits 2..7 (index 1..6)
 for (let i = 1; i <= 6; i++) {
 const d = parseInt(ean13[i], 10);
 const table = parity[i - 1] === "L" ? L : G;
 bits += table[d];
 }
 bits += "01010"; // center guard
 // right half: digits 8..13 (index 7..12)
 for (let i = 7; i <= 12; i++) {
 const d = parseInt(ean13[i], 10);
 bits += R[d];
 }
 bits += "101"; // end guard
 return bits;
 }

 /**
 * Draw an EAN-13 barcode onto a canvas element.
 * @param canvas - <canvas>
 * @param isbn - book ISBN
 * @param opts - { scale, height, dark, light, drawText }
 * Returns the normalized ean13 string, or null if invalid.
 */
 function draw(canvas, isbn, opts = {}) {
 const ean13 = normalizeEan13(isbn);
 if (!ean13) return null;

 const scale = opts.scale || 2; // px per module
 const height = opts.height || 60; // bar height in px (without text)
 const drawText = opts.drawText !== false;
 const textHeight = drawText ? 20 : 0;
 const dark = opts.dark || "#1a1a1a";
 const light = opts.light || "#ffffff";

 const moduleCount = 95;
 const quiet = 10 * scale; // quiet zone
 const width = moduleCount * scale + quiet * 2;
 const totalHeight = height + textHeight + (drawText ? 6 : 0);

 canvas.width = width;
 canvas.height = totalHeight;
 const ctx = canvas.getContext("2d");

 ctx.fillStyle = light;
 ctx.fillRect(0, 0, canvas.width, canvas.height);

 ctx.fillStyle = dark;
 const bits = buildPattern(ean13);
 for (let i = 0; i < bits.length; i++) {
 if (bits[i] === "1") {
 ctx.fillRect(quiet + i * scale, 0, scale, height);
 }
 }

 // Human-readable digits below the bars.
 if (drawText) {
 ctx.fillStyle = dark;
 ctx.font = "14px monospace";
 ctx.textAlign = "center";
 ctx.textBaseline = "alphabetic";
 const leftText = ean13.slice(0, 7);
 const rightText = ean13.slice(7);
 ctx.fillText(leftText, quiet + 14 * scale, totalHeight - 2);
 ctx.fillText(rightText, quiet + 7 * scale + 35 * scale + 7 * scale, totalHeight - 2);
 }

 return ean13;
 }

 // Draw a barcode then offer it as a downloadable PNG.
 function download(isbn, title) {
 const canvas = document.createElement("canvas");
 const ean13 = draw(canvas, isbn, { scale: 3, height: 80 });
 if (!ean13) return false;
 const link = document.createElement("a");
 const safe = String(title || isbn).replace(/[^\w\-]+/g, "_");
 link.download = `barcode_${safe}_${ean13}.png`;
 link.href = canvas.toDataURL("image/png");
 document.body.appendChild(link);
 link.click();
 link.remove();
 return true;
 }

 return { draw, download, normalizeEan13, checkDigit };
})();

// Browser global + optional CommonJS export (used by automated tests).
if (typeof window !== "undefined") window.Barcode = Barcode;
if (typeof module !== "undefined") module.exports = Barcode;
