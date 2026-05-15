function cleanTableForWord(table: HTMLTableElement): HTMLTableElement {
  const clone = table.cloneNode(true) as HTMLTableElement;
  clone.querySelectorAll("*").forEach((element) => {
    element.removeAttribute("style");
    element.removeAttribute("class");
  });
  clone.setAttribute("border", "1");
  clone.setAttribute("cellpadding", "2");
  clone.setAttribute("cellspacing", "0");
  return clone;
}

function flashCopySuccess(sectionId?: string): void {
  const active = document.activeElement;
  let button: HTMLElement | null =
    active instanceof HTMLElement && active.classList.contains("copy-icon-btn") ? active : null;

  if (!button && sectionId) {
    button = document.querySelector(
      `[data-section="${sectionId}"] .copy-icon-btn`,
    ) as HTMLElement | null;
  }
  if (!button) {
    return;
  }

  const original = button.innerHTML;
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  button.style.color = "#16a34a";
  button.setAttribute("title", "Kopyalandı");

  window.setTimeout(() => {
    button!.innerHTML = original;
    button!.style.color = "";
    button!.setAttribute("title", "Word'e kopyala");
  }, 1200);
}

export async function copyTableForWord(containerId: string): Promise<boolean> {
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      return false;
    }

    const tables = container.querySelectorAll("table");
    if (!tables.length) {
      return false;
    }

    const cleanParts: string[] = [];
    tables.forEach((table) => {
      cleanParts.push(cleanTableForWord(table as HTMLTableElement).outerHTML);
    });

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([cleanParts.join("<p>&nbsp;</p>")], { type: "text/html" }),
      }),
    ]);
    flashCopySuccess();
    return true;
  } catch (error) {
    console.error("copyTableForWord error:", error);
    return false;
  }
}

export async function copySectionForWord(sectionId: string): Promise<boolean> {
  try {
    const section = document.querySelector(`[data-section="${sectionId}"] .section-content`);
    if (!section) {
      return false;
    }

    const table = section.querySelector("table");
    if (!table) {
      return false;
    }

    const clean = cleanTableForWord(table as HTMLTableElement);
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([clean.outerHTML], { type: "text/html" }),
      }),
    ]);
    flashCopySuccess(sectionId);
    return true;
  } catch (error) {
    console.error("copySectionForWord error:", error);
    return false;
  }
}
