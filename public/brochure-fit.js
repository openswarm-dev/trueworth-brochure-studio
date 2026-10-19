// AI copy varies in length, so shrink any content page whose text would run
// past the bottom margin, and drop the corner illustration if text reaches it.
// Runs on screen (re-run once web fonts arrive) and before PDF export.
window.fitPages = () => {
  document.querySelectorAll(".page .flow").forEach((flow) => {
    const page = flow.closest(".page");
    const doodle = page.querySelector(".doodle");
    flow.style.zoom = 1;
    flow.style.width = "";
    if (doodle) doodle.style.display = "";
    const limit = () => page.getBoundingClientRect().bottom - 64; // keep clear of page number
    let z = 1;
    while (flow.getBoundingClientRect().bottom > limit() && z > 0.78) {
      z = Math.round((z - 0.02) * 100) / 100;
      flow.style.zoom = z;
      flow.style.width = `${100 / z}%`;
    }
    page.dataset.fit = z;
    if (doodle && flow.getBoundingClientRect().bottom > doodle.getBoundingClientRect().top + 8) doodle.style.display = "none";
  });
};
// fonts.ready can resolve before Montserrat starts loading, so also re-fit
// whenever a font finishes loading and once the whole page has loaded.
document.fonts.ready.then(() => window.fitPages());
document.fonts.addEventListener?.("loadingdone", () => window.fitPages());
window.addEventListener("load", () => window.fitPages());
