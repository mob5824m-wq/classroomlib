/* ============================================================
 * scanner.js — scan barcodes to check out, check in, and (for
 * admins) pull up a book's loan & hold details.
 *
 * Three input paths:
 * 1. Camera + Barcode Detection API (modern Chrome/Edge, https)
 * 2. Type / paste the number
 * 3. A physical USB barcode scanner (types the digits + Enter)
 * — just click the input field first.
 * ============================================================ */
const Scanner = (function () {
 const S = window.Store;
 let activeStream = null;
 let detectTimer = null;
 let videoEl = null;

 function stop() {
 if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
 if (detectTimer) { clearTimeout(detectTimer); detectTimer = null; }
 videoEl = null;
 }

 function hasCameraSupport() {
 return "BarcodeDetector" in window;
 }

 function setStatus(m, txt, kind) {
 const el = m.querySelector("#scan-status");
 if (el) { el.textContent = txt; el.className = "small muted scan-status" + (kind ? " " + kind: ""); }
 }

 function buildModal() {
 const m = document.createElement("div");
 m.className = "modal open";
 m.id = "scan-modal";
 m.innerHTML = `
 <div class="modal-card">
 <button class="modal-x" data-close>&times;</button>
 <h2> Scan a book</h2>
 <p class="muted small">Point your camera at the barcode on the back cover — or type the number below.</p>
 <div class="scan-video-wrap">
 <video id="scan-video" autoplay muted playsinline></video>
 <div id="scan-camera-off" class="empty" hidden>
 <div class="big"></div>
 <p>Camera scanning isn't available here. You can still type the barcode number below.</p>
 </div>
 </div>
 <p id="scan-status" class="small muted"></p>
 <div class="barcode-actions" style="margin-top:4px">
 <button type="button" class="btn btn-outline btn-sm" id="scan-start-camera" hidden>Start camera</button>
 <button class="btn btn-ghost btn-sm" data-close style="color:var(--ink-soft);border-color:var(--line)">Cancel</button>
 </div>
 <form id="scan-manual">
 <input id="scan-input" type="text" inputmode="numeric" autocomplete="off"
 placeholder="Type or scan the barcode number…">
 </form>
 </div>`;
 document.body.appendChild(m);
 return m;
 }

 // Request camera access and, if we can decode barcodes, start the live scan.
 function startCamera(m, finish) {
 const video = m.querySelector("#scan-video");
 const off = m.querySelector("#scan-camera-off");
 const startBtn = m.querySelector("#scan-start-camera");

 if (!navigator.mediaDevices ||!navigator.mediaDevices.getUserMedia) {
 setStatus(m, "Camera isn't supported in this browser — type the barcode number below.", "warn");
 off.hidden = false; video.hidden = true;
 return;
 }
 if (!hasCameraSupport()) {
 // Camera may exist, but we have no decoder. Tell the user clearly.
 setStatus(m, "Camera barcode reading needs Chrome or Edge. You can type the number below.", "warn");
 off.hidden = false; video.hidden = true;
 return;
 }

 setStatus(m, "Requesting camera access — please tap Allow when your browser asks.", "");
 video.hidden = true;

 navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
 .then(stream => {
   activeStream = stream;
   video.srcObject = stream;
   video.hidden = false;
   startBtn.hidden = true;
   off.hidden = true;
   return video.play();
 })
 .then(() => {
   setStatus(m, "Scanning… hold the barcode still in front of the camera.", "ok");
   const detector = new window.BarcodeDetector({
     formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "codabar"],
   });
   detectLoop(detector, video, m, finish);
 })
 .catch((err) => {
   off.hidden = false; video.hidden = true;
   const denied = err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
   if (denied) {
     setStatus(m, "Camera permission was blocked. Use the button below to ask again, or type the number.", "warn");
     startBtn.hidden = false;
   } else if (err && err.name === "NotFoundError") {
     setStatus(m, "No camera found — type the barcode number below.", "warn");
   } else {
     setStatus(m, "Couldn't start the camera — type the number below.", "warn");
     startBtn.hidden = false;
   }
 });
 }

 // The "Start camera" button re-requests access from a fresh user gesture.
 function bindCameraRetry(m, finish) {
 const startBtn = m.querySelector("#scan-start-camera");
 if (!startBtn) return;
 startBtn.addEventListener("click", (e) => {
   e.preventDefault();
   startCamera(m, finish);
 });
 }

 function detectLoop(detector, video, m, finish) {
 detector.detect(video).then(codes => {
 if (codes && codes.length) {
 finish(codes[0].rawValue);
 return;
 }
 // keep scanning
 if (video && video.srcObject) detectTimer = setTimeout(() => detectLoop(detector, video, m, finish), 250);
 }).catch(() => {
 if (video && video.srcObject) detectTimer = setTimeout(() => detectLoop(detector, video, m, finish), 250);
 });
 }

 // Resolves with the scanned string, or null if cancelled.
 function open() {
 return new Promise(resolve => {
 const m = buildModal();
 let done = false;
 const finish = (code) => {
 if (done) return; done = true;
 stop(); m.remove();
 resolve(code);
 };
 m.querySelector("#scan-manual").addEventListener("submit", e => {
 e.preventDefault();
 const v = m.querySelector("#scan-input").value.trim();
 if (v) finish(v);
 });
 m.querySelectorAll("[data-close]").forEach(x => x.addEventListener("click", () => finish(null)));
 m.addEventListener("click", e => { if (e.target === m) finish(null); });
 bindCameraRetry(m, finish);
 startCamera(m, finish);
 m.querySelector("#scan-input").focus();
 });
 }

 // Normalize a scanned/typed string into a 13-digit EAN-13.
 function normalize(code) {
 let digits = String(code || "").replace(/[^0-9]/g, "");
 if (!digits) return null;
 // If it's longer than 13, it's probably EAN + suffix — keep first 13.
 return digits.slice(0, 13);
 }

 return { open, stop, normalize };
})();

if (typeof window!== "undefined") window.Scanner = Scanner;
if (typeof module!== "undefined") module.exports = Scanner;
