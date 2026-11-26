/* BGAISolution One-Pager – Interaktionen */

(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Navigation ---------- */

  const nav = document.getElementById("nav");
  const navLinks = document.getElementById("navLinks");
  const navBurger = document.getElementById("navBurger");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 10);
  }, { passive: true });

  navBurger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    navBurger.classList.toggle("is-open", open);
    navBurger.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("nav-open", open);
  });

  const closeNav = () => {
    navLinks.classList.remove("is-open");
    navBurger.classList.remove("is-open");
    navBurger.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };

  navLinks.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("click", closeNav);
  });

  /* Beim Wechsel auf Desktop-Breite darf kein offenes Mobilmenü zurückbleiben. */
  const desktopQuery = window.matchMedia("(min-width: 861px)");
  const onBreakpoint = (e) => { if (e.matches) closeNav(); };
  if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", onBreakpoint);
  else desktopQuery.addListener(onBreakpoint);

  /* ---------- Scroll Reveal ---------- */

  const revealEls = document.querySelectorAll(".reveal");
  if (reducedMotion) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const pending = new Set(revealEls);
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
          pending.delete(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => revealObserver.observe(el));

    /* Fallback: fängt Elemente ab, die bei sehr schnellem Scrollen
       zwischen zwei Frames am Observer vorbeigerutscht sind. */
    let sweepQueued = false;
    const sweep = () => {
      sweepQueued = false;
      pending.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.95 || rect.bottom < 0) {
          el.classList.add("is-visible");
          revealObserver.unobserve(el);
          pending.delete(el);
        }
      });
    };
    window.addEventListener("scroll", () => {
      if (!sweepQueued && pending.size) {
        sweepQueued = true;
        requestAnimationFrame(sweep);
      }
    }, { passive: true });
  }

  /* ---------- Hero-Chat-Sequenz ----------
     Erzählt in einer Schleife die Produktstory: Frage → Bot tippt →
     Antwort → Lead wird erfasst. Läuft nur, solange sie sichtbar ist. */

  const heroPanel = document.querySelector(".hero__panel");
  const heroThread = document.getElementById("heroThread");
  const heroLead = document.querySelector(".hero__panel .leadcard--float");

  if (heroPanel && heroThread && heroLead) {
    const userMsg = heroThread.querySelector(".bubble--user");
    const typing = heroThread.querySelector(".hero-typing");
    const aiMsg = heroThread.querySelector(".hero-msg.bubble--ai");
    const fields = Array.from(heroLead.querySelectorAll(".leadcard__rows span"));
    const all = [userMsg, typing, aiMsg, heroLead].concat(fields);

    if (reducedMotion) {
      [userMsg, aiMsg, heroLead].concat(fields).forEach((el) => el.classList.add("is-in"));
    } else {
      let timers = [];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
      const reset = () => all.forEach((el) => el.classList.remove("is-in"));

      const play = () => {
        clearTimers();
        reset();
        at(500, () => userMsg.classList.add("is-in"));
        at(1400, () => typing.classList.add("is-in"));
        at(2700, () => {
          typing.classList.remove("is-in");
          aiMsg.classList.add("is-in");
        });
        at(3800, () => heroLead.classList.add("is-in"));
        fields.forEach((f, i) => at(4200 + i * 200, () => f.classList.add("is-in")));
        at(12000, play);
      };

      let running = false;
      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !running) {
            running = true;
            play();
          } else if (!entry.isIntersecting && running) {
            running = false;
            clearTimers();
            reset();
          }
        });
      }, { threshold: 0.25 });
      heroObserver.observe(heroPanel);

      /* Im Hintergrundtab nicht weiterlaufen lassen. */
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) clearTimers();
        else if (running) play();
      });
    }
  }

  /* ---------- ROI Count-Up ---------- */

  const roiNums = document.querySelectorAll(".roi__num");
  const countUp = (el) => {
    const target = parseInt(el.dataset.count, 10);
    if (reducedMotion) { el.textContent = target; return; }
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const roiObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        countUp(entry.target);
        roiObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  roiNums.forEach((el) => roiObserver.observe(el));

  /* ---------- Sticky Mobile CTA ---------- */

  const stickyCta = document.getElementById("stickyCta");
  const heroSection = document.querySelector(".hero");
  const finalSection = document.querySelector(".final");

  const updateSticky = () => {
    const heroBottom = heroSection.getBoundingClientRect().bottom;
    const finalTop = finalSection.getBoundingClientRect().top;
    const show = heroBottom < 0 && finalTop > window.innerHeight * 0.5;
    stickyCta.classList.toggle("is-visible", show);
  };
  window.addEventListener("scroll", updateSticky, { passive: true });

  /* ---------- Booking Modal ---------- */

  const modal = document.getElementById("bookingModal");
  const modalBody = document.getElementById("modalBody");
  const modalSuccess = document.getElementById("modalSuccess");
  const bookingForm = document.getElementById("bookingForm");
  let lastFocused = null;

  const openModal = () => {
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    const firstInput = bookingForm.querySelector("input");
    if (firstInput && !modalBody.hidden) setTimeout(() => firstInput.focus(), 320);
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocused) lastFocused.focus();
  };

  document.querySelectorAll("[data-open-booking]").forEach((btn) => {
    btn.addEventListener("click", openModal);
  });
  document.querySelectorAll("[data-close-booking]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  /* Anfrage an kontakt.php senden. Das PHP-Skript verschickt die Mail an
     office@bgaisolution.com – Empfänger dort ändern, nicht hier. */
  const formError = document.getElementById("formError");
  const formSubmit = document.getElementById("formSubmit");
  const submitLabel = formSubmit.textContent;
  let sending = false;

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;

    /* Browser-Validierung selbst auslösen, da novalidate gesetzt ist. */
    if (!bookingForm.checkValidity()) {
      bookingForm.reportValidity();
      return;
    }

    sending = true;
    formError.hidden = true;
    formSubmit.disabled = true;
    formSubmit.textContent = "Wird gesendet …";

    try {
      const res = await fetch(bookingForm.action, {
        method: "POST",
        body: new FormData(bookingForm),
        headers: { Accept: "application/json" }
      });

      let data = {};
      try { data = await res.json(); } catch (_) { /* kein JSON zurückbekommen */ }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Unbekannter Fehler");
      }

      modalBody.hidden = true;
      modalSuccess.hidden = false;
    } catch (err) {
      formError.innerHTML =
        'Das Senden hat leider nicht geklappt. Schreiben Sie uns bitte direkt an ' +
        '<a href="mailto:office@bgaisolution.com">office@bgaisolution.com</a> ' +
        'oder rufen Sie an: <a href="tel:+436764354373">+43 676 4354373</a>.';
      formError.hidden = false;
    } finally {
      sending = false;
      formSubmit.disabled = false;
      formSubmit.textContent = submitLabel;
    }
  });

})();
