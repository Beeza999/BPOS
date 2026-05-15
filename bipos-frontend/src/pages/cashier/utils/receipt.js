export function printReceipt({ bill, payment, received, receiptWindow, paymentMethod, money }) {
  const win = receiptWindow || window.open("", "_blank", "width=420,height=700");
  if (!win) {
    alert("ບຣາວເຊີບລັອກ popup ກະລຸນາອະນຸຍາດ popup ເພື່ອພິມບິນ");
    return;
  }

  const esc = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const itemsHtml = (bill.items || []).map((item) => {
    const qty = Number(item.quantity || item.qty || 1);
    const price = Number(item.price || 0);
    const lineTotal = price * qty;
    return `
      <tr>
        <td><b>${esc(item.name)}</b>${item.note ? `<div class="note">${esc(item.note)}</div>` : ""}</td>
        <td class="center">${qty}</td>
        <td class="right">${money(lineTotal)}</td>
      </tr>`;
  }).join("");

  const now = new Date();
  const receiptNo = payment?.billNumber || payment?.id || bill.id || now.getTime();
  const service = payment.serviceCharge ?? payment.service ?? 0;

  win.document.open();
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>ໃບບິນ</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 14px; font-family: Arial, "Noto Sans Lao", sans-serif; color: #111827; background: #fff; font-size: 13px; }
          .receipt { width: 300px; margin: 0 auto; }
          .center { text-align: center; }
          .right { text-align: right; }
          .title { font-size: 20px; font-weight: 800; text-align: center; }
          .muted { color: #6b7280; font-size: 12px; }
          .line { border-top: 1px dashed #9ca3af; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; gap: 12px; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { color: #6b7280; font-weight: 700; border-bottom: 1px dashed #9ca3af; padding: 6px 0; }
          td { padding: 6px 0; vertical-align: top; border-bottom: 1px dashed #e5e7eb; }
          .note { margin-top: 2px; color: #92400e; font-size: 11px; }
          .total { font-size: 18px; font-weight: 900; }
          .thanks { margin-top: 14px; text-align: center; font-weight: 800; }
          @media print { body { padding: 0; } .receipt { width: 72mm; padding: 6px; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="title">BIPOS</div>
          <div class="center muted">ໃບບິນ</div>
          <div class="line"></div>
          <div class="row"><span>ເລກບິນ</span><b>${esc(receiptNo)}</b></div>
          <div class="row"><span>ໂຕະ</span><b>${esc(bill.table?.name || "-")}</b></div>
          <div class="row"><span>ວັນທີ</span><b>${esc(now.toLocaleString("lo-LA"))}</b></div>
          <div class="row"><span>ວິທີຊຳລະ</span><b>${esc(paymentMethod)}</b></div>
          <div class="line"></div>
          <table><thead><tr><th align="left">ລາຍການ</th><th class="center">ຈຳນວນ</th><th class="right">ລວມ</th></tr></thead><tbody>${itemsHtml}</tbody></table>
          <div class="line"></div>
          <div class="row"><span>ລວມ</span><b>${money(payment.subtotal)}</b></div>
          <div class="row"><span>ສ່ວນຫຼຸດ</span><b>-${money(payment.discount)}</b></div>
          <div class="row"><span>ບໍລິການ</span><b>${money(service)}</b></div>
          <div class="row"><span>ອາກອນ</span><b>${money(payment.vat)}</b></div>
          <div class="row total"><span>ຍອດສຸດທິ</span><span>${money(payment.total)}</span></div>
          <div class="row"><span>ຮັບເງິນ</span><b>${money(received)}</b></div>
          <div class="row"><span>ເງິນທອນ</span><b>${money(Math.max(0, received - payment.total))}</b></div>
          <div class="line"></div><div class="thanks">ຂອບໃຈຫຼາຍໆ</div>
        </div>
        <script>window.onload = function () { window.focus(); setTimeout(function () { window.print(); }, 250); };</script>
      </body>
    </html>`);
  win.document.close();
}
