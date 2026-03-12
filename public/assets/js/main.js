(function headerStateController() {
  const root = document.documentElement;
  let ticking = false;

  function updateHeaderState() {
    root.dataset.headerState = window.scrollY > 18 ? "compact" : "expanded";
    ticking = false;
  }

  updateHeaderState();

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(updateHeaderState);
    },
    { passive: true }
  );
})();

(function activeChipScroller() {
  const activeChip = document.querySelector(".nav-chip[aria-current='page']");

  if (!activeChip) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  activeChip.scrollIntoView({
    block: "nearest",
    inline: "center",
    behavior: reducedMotion ? "auto" : "smooth"
  });
})();

(function topLinkController() {
  const topLink = document.getElementById("top-link");

  if (!topLink) {
    return;
  }

  function updateTopLink() {
    const isVisible = document.documentElement.scrollTop > 360 || document.body.scrollTop > 360;

    topLink.style.visibility = isVisible ? "visible" : "hidden";
    topLink.style.opacity = isVisible ? "1" : "0";
  }

  updateTopLink();

  window.addEventListener("scroll", updateTopLink, { passive: true });
})();

(function themeController() {
  const themeToggle = document.getElementById("theme-toggle");

  if (!themeToggle) {
    return;
  }

  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;

    if (html.dataset.theme === "dark") {
      html.dataset.theme = "light";
      localStorage.setItem("pref-theme", "light");
      return;
    }

    html.dataset.theme = "dark";
    localStorage.setItem("pref-theme", "dark");
  });
})();

(function searchFocusController() {
  const searchInput = document.querySelector("[data-search-input]");

  if (!searchInput) {
    return;
  }

  const body = document.body;

  searchInput.addEventListener("focus", () => {
    body.classList.add("is-search-focus");
  });

  searchInput.addEventListener("blur", () => {
    body.classList.remove("is-search-focus");
  });
})();

(function sourceCtaFeedback() {
  const cta = document.querySelector("[data-source-cta]");
  const label = cta && cta.querySelector(".source-cta-label");

  if (!cta || !label) {
    return;
  }

  const defaultLabel = cta.dataset.labelDefault || label.textContent;
  const openLabel = cta.dataset.labelOpen || defaultLabel;
  let resetTimer = null;

  function resetLabel() {
    label.textContent = defaultLabel;
    cta.classList.remove("is-opening");
  }

  cta.addEventListener("click", () => {
    window.clearTimeout(resetTimer);
    cta.classList.add("is-opening");
    label.textContent = openLabel;
    resetTimer = window.setTimeout(resetLabel, 1400);
  });

  window.addEventListener("pageshow", resetLabel);
})();

(function smoothAnchor() {
  const anchors = document.querySelectorAll('a[href^="#"]');

  anchors.forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const raw = anchor.getAttribute("href");
      if (!raw || raw.length <= 1) {
        return;
      }

      event.preventDefault();
      const targetId = decodeURIComponent(raw.slice(1));
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start"
      });
      history.pushState(null, "", raw);
    });
  });
})();
