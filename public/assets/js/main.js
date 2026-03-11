(function menuController() {
  const toggleButton = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  if (!toggleButton || !menu) {
    return;
  }

  function closeMenu() {
    menu.classList.remove("active");
    toggleButton.classList.remove("active");
    toggleButton.setAttribute("aria-expanded", "false");
  }

  toggleButton.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("active");
    toggleButton.classList.toggle("active");
    toggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!toggleButton.contains(event.target) && !menu.contains(event.target)) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
})();

(function topLinkController() {
  const topLink = document.getElementById("top-link");

  if (!topLink) {
    return;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (document.body.scrollTop > 800 || document.documentElement.scrollTop > 800) {
        topLink.style.visibility = "visible";
        topLink.style.opacity = "1";
      } else {
        topLink.style.visibility = "hidden";
        topLink.style.opacity = "0";
      }
    },
    { passive: true }
  );
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
      target.scrollIntoView(reducedMotion ? undefined : { behavior: "smooth" });
      history.pushState(null, "", raw);
    });
  });
})();
