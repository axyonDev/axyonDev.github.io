(() => {
  const body = document.body;
  const root = body.dataset.root || "";
  const page = body.dataset.page || "home";
  const playDeveloper = "https://play.google.com/store/apps/developer?id=axyon";

  const header = document.querySelector("[data-site-header]");
  const footer = document.querySelector("[data-site-footer]");

  if (header) {
    header.innerHTML = `
      <a class="skip-link" href="#main" data-i18n="skip">Ana içeriğe geç</a>
      <header class="site-header">
        <div class="container header-inner">
          <a class="brand" href="${root}index.html" aria-label="AXYON.DEV">
            <span class="brand__mark" aria-hidden="true"></span>
            <span class="brand__text">AXYON<small>.DEV</small></span>
          </a>
          <nav class="site-nav" id="site-nav" aria-label="Primary navigation">
            <a href="${root}index.html#products" data-i18n="nav_products">Ürünler</a>
            <a href="${root}privacy.html" data-i18n="nav_trust">Güven & Gizlilik</a>
            <a href="${root}about.html" data-i18n="nav_about">Hakkımızda</a>
            <a href="mailto:axyon.dev@gmail.com" data-i18n="nav_support">Destek</a>
            <div class="lang-switch mobile-lang-switch" aria-label="Language">
              ${langButtons()}
            </div>
          </nav>
          <div class="header-actions">
            <div class="lang-switch" aria-label="Language">${langButtons()}</div>
            <button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav"><span></span></button>
          </div>
        </div>
      </header>`;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <a class="brand" href="${root}index.html"><span class="brand__mark" aria-hidden="true"></span><span class="brand__text">AXYON<small>.DEV</small></span></a>
              <p class="footer-copy" data-i18n="footer_desc">Günlük hayatta gerçek karşılığı olan, sade ve güvenilir mobil ürünler geliştiren bağımsız yazılım markası.</p>
            </div>
            <div class="footer-col">
              <h3 data-i18n="footer_products">Ürünler</h3>
              <div class="footer-links">
                <a href="${root}zikirmatik/index.html">Zikirmatik – Axyon</a>
                <a href="${root}kasa-defteri/index.html">Kasa Defteri – Axyon</a>
                <a href="${playDeveloper}" target="_blank" rel="noopener" data-i18n="play_store">Google Play</a>
              </div>
            </div>
            <div class="footer-col">
              <h3 data-i18n="footer_legal">Gizlilik</h3>
              <div class="footer-links">
                <a href="${root}privacy.html" data-i18n="footer_privacy_hub">Gizlilik merkezi</a>
                <a href="${root}delete-data.html" data-i18n="footer_delete">Veri silme talebi</a>
                <a href="mailto:axyon.dev@gmail.com">axyon.dev@gmail.com</a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© 2026 AXYON.DEV · <span data-i18n="footer_rights">Tüm hakları saklıdır.</span></span>
            <span>Android · TR / EN / AR</span>
          </div>
        </div>
      </footer>`;
  }

  function langButtons() {
    return ["tr", "en", "ar"].map(lang => `<button class="lang-btn" type="button" data-lang="${lang}">${lang.toUpperCase()}</button>`).join("");
  }

  const getSavedLanguage = () => {
    try {
      const saved = localStorage.getItem("axyon-language");
      if (["tr", "en", "ar"].includes(saved)) return saved;
    } catch (_) {}
    const browser = (navigator.language || "tr").slice(0, 2).toLowerCase();
    return ["tr", "en", "ar"].includes(browser) ? browser : "tr";
  };

  function setLanguage(lang) {
    const dictionary = window.AXYON_I18N?.[lang] || window.AXYON_I18N?.tr || {};
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const value = dictionary[el.dataset.i18n];
      if (value !== undefined) el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const value = dictionary[el.dataset.i18nHtml];
      if (value !== undefined) el.innerHTML = value;
    });
    document.querySelectorAll("[data-lang]").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.lang === lang);
      btn.setAttribute("aria-pressed", btn.dataset.lang === lang ? "true" : "false");
    });
    document.querySelectorAll("[data-legal-tab]").forEach(tab => tab.classList.toggle("is-active", tab.dataset.legalTab === lang));
    document.querySelectorAll("[data-legal-pane]").forEach(pane => pane.classList.toggle("is-active", pane.dataset.legalPane === lang));
    document.querySelectorAll("[data-mailto-key]").forEach(el => {
      const subject = lang === "tr" ? "Veri Silme Talebi" : lang === "ar" ? "طلب حذف البيانات" : "Data Deletion Request";
      const appLabel = lang === "tr" ? "Uygulama" : lang === "ar" ? "التطبيق" : "App";
      const emailLabel = lang === "tr" ? "Kayıtlı e-posta" : lang === "ar" ? "البريد المسجل" : "Registered email";
      el.href = `mailto:axyon.dev@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${appLabel}: \n${emailLabel}: \n`)}`;
    });
    try { localStorage.setItem("axyon-language", lang); } catch (_) {}
  }

  document.addEventListener("click", event => {
    const langBtn = event.target.closest("[data-lang]");
    if (langBtn) setLanguage(langBtn.dataset.lang);
  });
  setLanguage(getSavedLanguage());

  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".site-nav");
  menu?.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!open));
    nav?.classList.toggle("is-open", !open);
  });
  nav?.addEventListener("click", event => {
    if (event.target.closest("a")) {
      nav.classList.remove("is-open");
      menu?.setAttribute("aria-expanded", "false");
    }
  });

  const stickyHeader = document.querySelector(".site-header");
  const onScroll = () => stickyHeader?.classList.toggle("is-scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }), { threshold: .12, rootMargin: "0px 0px -40px" })
    : null;
  document.querySelectorAll(".reveal").forEach(el => observer ? observer.observe(el) : el.classList.add("is-visible"));

  document.querySelectorAll("[data-legal-tabs]").forEach(group => {
    const tabs = group.querySelectorAll("[data-legal-tab]");
    const card = group.nextElementSibling;
    const panes = card?.querySelectorAll("[data-legal-pane]") || [];
    tabs.forEach(tab => tab.addEventListener("click", () => {
      const lang = tab.dataset.legalTab;
      tabs.forEach(item => item.classList.toggle("is-active", item === tab));
      panes.forEach(pane => pane.classList.toggle("is-active", pane.dataset.legalPane === lang));
      setLanguage(lang);
    }));
  });

  if (page === "home" && window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    const heroVisual = document.querySelector(".hero-visual");
    window.addEventListener("pointermove", event => {
      if (!heroVisual || window.innerWidth < 900) return;
      const x = (event.clientX / window.innerWidth - .5) * 10;
      const y = (event.clientY / window.innerHeight - .5) * 8;
      heroVisual.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }, { passive: true });
  }
})();
