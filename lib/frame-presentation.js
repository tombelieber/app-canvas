// This cue lives inside the original app, so it follows its scroll containers
// and native viewport. It never substitutes for an app control or assertion.
export async function presentTarget(element, { delay = 0 } = {}) {
  const bounds = element.getBoundingClientRect(), pointer = document.createElement("div");
  pointer.setAttribute("data-canvas-demo-pointer", "");
  pointer.setAttribute("aria-hidden", "true");
  Object.assign(pointer.style, {
    position: "fixed", left: `${bounds.left + bounds.width / 2}px`, top: `${bounds.top + bounds.height / 2}px`,
    width: "26px", height: "26px", margin: "-13px", borderRadius: "50%", border: "3px solid white",
    background: "#287b83cc", boxShadow: "0 0 0 5px #287b8340, 0 2px 10px #163b4560",
    pointerEvents: "none", zIndex: "2147483647",
  });
  (element.closest("dialog[open]") || document.body).append(pointer);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    pointer.animate?.([{ transform: "scale(1.5)", opacity: .4 }, { transform: "scale(1)", opacity: 1 }], { duration: 250 });
  }
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Math.min(900, Number(delay) || 0))));
  return () => pointer.remove();
}
