async function ensurePdfLibraries(): Promise<void> {
  const load = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`script load failed: ${src}`));
      document.body.appendChild(script);
    });

  const windowWithLibs = window as Window & {
    html2canvas?: unknown;
    jspdf?: { jsPDF?: unknown };
  };

  if (!windowWithLibs.html2canvas) {
    await load("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
  }
  if (!windowWithLibs.jspdf?.jsPDF) {
    await load("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
  }
}

export async function downloadPdfFromDOM(
  title: string,
  containerId: string,
  fileName?: string,
): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 100));
  await ensurePdfLibraries();

  const source = document.getElementById(containerId);
  if (!source) {
    throw new Error(`PDF generation: Content not found for ID: ${containerId}`);
  }

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.background = "#ffffff";
  container.style.width = "850px";
  container.style.padding = "20px";
  container.style.boxSizing = "border-box";

  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = "100%";
  clone.style.width = "100%";
  clone.style.visibility = "visible";
  clone.style.opacity = "1";
  clone.style.display = "block";
  clone.style.position = "static";
  clone.style.left = "auto";
  clone.style.top = "auto";
  clone.style.zIndex = "auto";
  container.appendChild(clone);
  document.body.appendChild(container);

  await new Promise((resolve) => window.setTimeout(resolve, 300));

  const windowWithLibs = window as Window & {
    html2canvas: (element: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>;
    jspdf: { jsPDF: new (options: Record<string, unknown>) => {
      addImage: (...args: unknown[]) => void;
      addPage: () => void;
      save: (name: string) => void;
    } };
  };

  const canvas = await windowWithLibs.html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: container.scrollWidth,
    height: container.scrollHeight,
  });

  const imageData = canvas.toDataURL("image/png");
  const pdf = new windowWithLibs.jspdf.jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;
  const ratio = canvas.width / usableWidth;
  const pdfImageWidth = usableWidth;
  const pdfImageHeight = canvas.height / ratio;

  let heightLeft = pdfImageHeight;
  let position = 0;

  pdf.addImage(imageData, "PNG", margin, margin, pdfImageWidth, Math.min(pdfImageHeight, usableHeight));
  heightLeft -= usableHeight;

  while (heightLeft > 0) {
    position = heightLeft - pdfImageHeight;
    pdf.addPage();
    pdf.addImage(imageData, "PNG", margin, position + margin, pdfImageWidth, pdfImageHeight);
    heightLeft -= usableHeight;
  }

  const date = new Date().toISOString().slice(0, 10);
  pdf.save(fileName || `${title.replace(/\s+/g, "_")}_${date}.pdf`);
  document.body.removeChild(container);
}
