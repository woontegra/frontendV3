export function printFromModal(title: string, copyTargetId?: string): void {
  try {
    const container = document.getElementById("report-modal-content");
    let source: string | null = null;

    if (container && copyTargetId) {
      const target = container.querySelector(`#${copyTargetId}`);
      if (target) {
        source = (target as HTMLElement).outerHTML;
      }
    }

    if (!source && copyTargetId) {
      const target = document.getElementById(copyTargetId);
      source = target ? target.outerHTML : null;
    }

    if (!source && container) {
      source = container.innerHTML;
    }

    if (!source) {
      console.error("Yazdırma için içerik bulunamadı", { copyTargetId });
      return;
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
  * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 0; margin: 0; }
    .print-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead { background: #f3f4f6; }
    th, td { border: 1px solid #999; padding: 6px; font-size: 12px; }
    th { text-align: left; font-weight: 600; }
    td { text-align: right; }
    td:first-child { white-space: nowrap; text-align: left; }
    button { display: none !important; }
  </style>
</head>
<body>
  <div class="print-title">${title}</div>
  ${source}
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (error) {
        console.error("Yazdırma hatası:", error);
      }
      window.setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // ignore
        }
      }, 400);
    };
  } catch (error) {
    console.error("Yazdırma işlemi başarısız:", error);
  }
}
