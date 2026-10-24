(function () {
  const SELECTOR = [
    ".btn",
    ".ai-fab",
    ".nav-toggle",
    ".stage-cta",
    ".quiz-options button",
    ".chips button",
    ".filters button",
    ".path-step",
    ".faq-item",
    ".nav-links a",
  ].join(", ");

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function spawnRipple(target, event) {
    if (prefersReducedMotion()) return;
    const style = window.getComputedStyle(target);
    if (style.position === "static") {
      target.style.position = "relative";
    }

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.35;
    const x = (event.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (event.clientY || rect.top + rect.height / 2) - rect.top - size / 2;

    const ripple = document.createElement("span");
    ripple.className = "tap-ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    target.append(ripple);
    window.setTimeout(() => ripple.remove(), 700);
  }

  function flash(target) {
    target.classList.add("is-tapped");
    window.setTimeout(() => target.classList.remove("is-tapped"), 480);
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      const target = event.target.closest(SELECTOR);
      if (!target) return;

      flash(target);
      if (
        target.matches(
          ".btn, .ai-fab, .nav-toggle, .stage-cta, .quiz-options button, .chips button, .filters button"
        )
      ) {
        spawnRipple(target, event);
      }

      if (target.matches(".quiz-options button")) {
        target.parentElement?.querySelectorAll("button").forEach((node) => {
          node.classList.toggle("is-selected", node === target);
        });
      }
    },
    true
  );
})();
