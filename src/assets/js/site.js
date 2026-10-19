// Progressive enhancement for the mobile menu. Without this script the
// navigation links stay visible and usable.
(() => {
  document.documentElement.classList.add("js");

  const init = () => {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = toggle && document.getElementById(toggle.getAttribute("aria-controls"));
    if (!nav) return;

    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    };

    toggle.addEventListener("click", () => setOpen(!isOpen()));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Close after choosing a link (matters for same-page links like /#services).
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    // Reset when the layout switches to the desktop navigation.
    window.matchMedia("(min-width: 48rem)").addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
