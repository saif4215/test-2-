// "Get directions" opens a small chooser: Google Maps, Apple Maps or Waze.
const dlg = document.getElementById("directions");
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-directions]")) {
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
    else window.open(dlg?.querySelector("a")?.href, "_blank", "noopener");
  } else if (dlg && dlg.open && (e.target === dlg || e.target.closest("[data-close]") || e.target.closest("#directions a"))) dlg.close();
});
