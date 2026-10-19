// Loaded inside the brochure iframe in edit mode. Makes copy editable and
// hands the edited values back to the app as { "json.path": "text" }.
(() => {
  const toMarkup = (el) => {
    const walk = (node) =>
      [...node.childNodes]
        .map((n) => {
          if (n.nodeType === Node.TEXT_NODE) return n.textContent;
          if (n.nodeName === "BR") return " ";
          const inner = walk(n);
          if (n.nodeName === "STRONG" || n.nodeName === "B") return `**${inner}**`;
          if (n.classList?.contains("accent")) return `[[${inner}]]`;
          return inner;
        })
        .join("");
    return walk(el).replace(/\s+/g, " ").replace(/\*\*\s*\*\*/g, "").trim();
  };

  document.querySelectorAll("[data-edit]").forEach((el) => {
    el.contentEditable = "true";
    el.spellcheck = true;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
      // Ctrl/Cmd+B bolds; Ctrl/Cmd+K toggles the pink accent on the selection.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && el.dataset.rich) {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) return;
        const span = document.createElement("span");
        span.className = "accent";
        span.appendChild(sel.getRangeAt(0).extractContents());
        sel.getRangeAt(0).insertNode(span);
      }
    });
    el.addEventListener("input", () => parent.postMessage({ type: "brochure-dirty" }, "*"));
    el.addEventListener("paste", (e) => {
      e.preventDefault();
      document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    });
  });

  window.addEventListener("message", (e) => {
    // Fact check tab: jump to the flagged text.
    if (e.data?.type === "focus-path") {
      const el = document.querySelector(`[data-edit="${CSS.escape(e.data.path)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("fc-focus");
      void el.offsetWidth;
      el.classList.add("fc-focus");
      return;
    }
    if (e.data?.type !== "collect-edits") return;
    const edits = {};
    document.querySelectorAll("[data-edit]").forEach((el) => {
      edits[el.dataset.edit] = el.dataset.rich ? toMarkup(el) : el.textContent.replace(/\s+/g, " ").trim();
    });
    parent.postMessage({ type: "brochure-edits", edits }, "*");
  });
})();
