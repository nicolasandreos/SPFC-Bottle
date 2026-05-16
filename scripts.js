/* =================================================================
   SMOOTH INTERNAL NAVIGATION
================================================================= */
(() => {
  const navHeight = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(
      "--nav-h",
    );
    return Number.parseFloat(value) || 72;
  };

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function smoothScrollTo(target) {
    const startY = window.scrollY;
    const rect = target.getBoundingClientRect();
    const endY = Math.max(0, startY + rect.top - navHeight() - 8);
    const distance = Math.abs(endY - startY);
    const duration = Math.min(900, Math.max(340, distance * 0.32));
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      window.scrollTo(0, startY + (endY - startY) * eased);
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      smoothScrollTo(target);
      history.pushState(null, "", href);
    });
  });
})();

/* =================================================================
   MOBILE MENU
================================================================= */
(() => {
  const hamburger = document.getElementById("navHamburger");
  const menu = document.getElementById("mobileMenu");
  const navLinks = menu?.querySelectorAll(".mobile-nav-link, .mobile-menu-cta");
  const body = document.body;

  if (!hamburger || !menu) return;

  let isOpen = false;

  function openMenu() {
    isOpen = true;
    hamburger.classList.add("is-open");
    hamburger.setAttribute("aria-expanded", "true");
    menu.classList.add("is-open");
    menu.removeAttribute("aria-hidden");
    body.style.overflow = "hidden";
    setTimeout(() => menu.querySelector(".mobile-nav-link")?.focus(), 80);
  }

  function closeMenu() {
    isOpen = false;
    hamburger.classList.remove("is-open");
    hamburger.setAttribute("aria-expanded", "false");
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    body.style.overflow = "";
    hamburger.focus();
  }

  hamburger.addEventListener("click", () => {
    if (isOpen) closeMenu();
    else openMenu();
  });

  navLinks?.forEach((link) => {
    link.addEventListener("click", () => {
      if (isOpen) closeMenu();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) closeMenu();
  });

  const mq = window.matchMedia("(min-width: 761px)");
  mq.addEventListener("change", (e) => {
    if (e.matches && isOpen) closeMenu();
  });
})();

/* =================================================================
   HERO — scroll progress + nav state + mouse parallax
================================================================= */
(() => {
  const hero     = document.getElementById("hero");
  const nav      = document.getElementById("nav");
  const photoImg = document.getElementById("heroPhotoImg");
  const badge    = document.getElementById("heroBadge");

  if (!hero) return;

  // ── Scroll progress bar ──────────────────────────────────────────
  function onScroll() {
    const docScrollable =
      document.documentElement.scrollHeight - window.innerHeight;
    const progress =
      docScrollable > 0 ? window.scrollY / docScrollable : 0;
    document.documentElement.style.setProperty(
      "--scroll-progress",
      progress.toFixed(4),
    );
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ── Mouse parallax (mouse-driven devices only) ────────────────────
  // The photo shifts subtly toward the cursor; the badge drifts the
  // opposite way. Two layers at different depths create a 3-D feeling
  // without any heavy library.
  if (!window.matchMedia("(pointer: fine)").matches) return;

  const PHOTO_MAX  = 16;   // max px photo shift in each axis
  const BADGE_MAX  = 9;    // max px badge counter-shift
  const LERP_PHOTO = 0.055; // easing per rAF tick (~60 fps)
  const LERP_BADGE = 0.038;

  let cx = 0.5, cy = 0.5;   // raw cursor [0..1]
  let px = 0.5, py = 0.5;   // eased photo
  let bx = 0.5, by = 0.5;   // eased badge
  let rafId = 0;
  let heroActive = false;

  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    cx = (e.clientX - r.left)  / r.width;
    cy = (e.clientY - r.top)   / r.height;
  });
  hero.addEventListener("pointerleave", () => { cx = 0.5; cy = 0.5; });

  function tick() {
    px += (cx - px) * LERP_PHOTO;
    py += (cy - py) * LERP_PHOTO;
    bx += (cx - bx) * LERP_BADGE;
    by += (cy - by) * LERP_BADGE;

    // Photo: shifts toward cursor on top of its initial scale(1.04)
    const pdx = (px - 0.5) * PHOTO_MAX;
    const pdy = (py - 0.5) * PHOTO_MAX;
    if (photoImg) {
      photoImg.style.transform = `scale(1.04) translate(${pdx.toFixed(2)}px, ${pdy.toFixed(2)}px)`;
    }

    // Badge: counter-shifts for depth illusion
    if (badge) {
      const bdx = (bx - 0.5) * -BADGE_MAX;
      const bdy = (by - 0.5) * -BADGE_MAX;
      badge.style.transform = `translate(${bdx.toFixed(2)}px, ${bdy.toFixed(2)}px)`;
    }

    if (heroActive) rafId = requestAnimationFrame(tick);
  }

  // Only run the rAF loop while the hero is visible in the viewport.
  const obs = new IntersectionObserver(
    ([entry]) => {
      heroActive = entry.isIntersecting;
      if (heroActive && !rafId) {
        rafId = requestAnimationFrame(tick);
      } else if (!heroActive) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
    { threshold: 0.1 },
  );
  obs.observe(hero);
})();

/* =================================================================
   PRODUCT SECTION MOTION
================================================================= */
(() => {
  const section = document.querySelector(".product-section");
  if (!section) return;

  const productVisual = section.querySelector(".product-visual");
  const revealItems = section.querySelectorAll(
    ".product-reveal:not(.product-visual)",
  );
  const photoCard = document.getElementById("productPhotoCard");
  const photo = document.getElementById("productPhoto");

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.set(revealItems, { opacity: 0, y: 28, filter: "blur(12px)" });
    gsap.set(productVisual, {
      opacity: 0,
      x: "-24vw",
      y: 42,
      rotate: -8,
      filter: "blur(18px)",
    });
    gsap.set(photoCard, { rotate: -5, scale: 0.94 });
    gsap.set(photo, { scale: 1.18, xPercent: -6 });

    const productIntro = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 68%",
        once: true,
      },
    });

    productIntro
      .to(productVisual, {
        opacity: 1,
        x: 0,
        y: 0,
        rotate: 0,
        filter: "blur(0px)",
        duration: 1.35,
        ease: "expo.out",
      })
      .to(
        photoCard,
        {
          rotate: 0,
          scale: 1,
          duration: 1.1,
          ease: "elastic.out(1, 0.78)",
        },
        "-=1.05",
      )
      .to(
        photo,
        {
          xPercent: 0,
          scale: 1.08,
          duration: 1.25,
          ease: "power3.out",
        },
        "-=1.15",
      )
      .to(
        revealItems,
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
        },
        "-=0.55",
      );

    gsap.fromTo(
      photoCard,
      { y: 56 },
      {
        y: -36,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      },
    );

    gsap.fromTo(
      photo,
      { yPercent: -3 },
      {
        yPercent: 4,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      },
    );

    section.querySelectorAll(".benefit-card").forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        card.style.setProperty("--mx", `${x}px`);
        card.style.setProperty("--my", `${y}px`);
      });
    });

    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        productVisual.classList.add("is-visible");
        revealItems.forEach((item, index) => {
          setTimeout(() => item.classList.add("is-visible"), index * 80);
        });
        observer.disconnect();
      });
    },
    { threshold: 0.22 },
  );

  observer.observe(section);
})();

/* =================================================================
   RED FEATURE MOTION
================================================================= */
(() => {
  const section = document.querySelector(".red-feature");
  if (!section) return;

  const revealItems = section.querySelectorAll(".red-reveal");
  const bottleVisual = document.getElementById("redBottleVisual");
  const bottle = document.getElementById("featureBottle");
  const stats = section.querySelectorAll(".red-stat-number");

  function animateStats() {
    stats.forEach((stat) => {
      if (stat.dataset.done) return;
      stat.dataset.done = "true";
      const target = Number(stat.dataset.count || 0);
      const suffix = stat.querySelector("span")?.outerHTML || "";
      const obj = { value: 0 };

      if (window.gsap) {
        gsap.to(obj, {
          value: target,
          duration: 1.5,
          ease: "power3.out",
          onUpdate: () => {
            stat.innerHTML = `${Math.round(obj.value)}${suffix}`;
          },
        });
        return;
      }

      const start = performance.now();
      const duration = 1300;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        stat.innerHTML = `${Math.round(target * eased)}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.set(revealItems, { opacity: 0, y: 30, filter: "blur(12px)" });
    gsap.set(bottleVisual, {
      opacity: 0,
      x: "22vw",
      rotate: 8,
      scale: 0.84,
      filter: "blur(18px)",
    });
    gsap.set(bottle, { y: 42, rotate: -5, scale: 0.96 });

    const intro = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 66%",
        once: true,
        onEnter: animateStats,
      },
    });

    intro
      .to(bottleVisual, {
        opacity: 1,
        x: 0,
        rotate: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: 1.25,
        ease: "expo.out",
      })
      .to(
        bottle,
        {
          y: 0,
          rotate: 0,
          scale: 1,
          duration: 1.15,
          ease: "elastic.out(1, 0.7)",
        },
        "-=1.05",
      )
      .to(
        revealItems,
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.86,
          ease: "power3.out",
          stagger: 0.08,
        },
        "-=0.62",
      );

    gsap.to(bottle, {
      y: -18,
      rotate: 1.4,
      duration: 2.8,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    gsap.fromTo(
      bottleVisual,
      { y: 56 },
      {
        y: -44,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.9,
        },
      },
    );

    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        bottleVisual?.classList.add("is-visible");
        revealItems.forEach((item, index) => {
          setTimeout(() => item.classList.add("is-visible"), index * 80);
        });
        animateStats();
        observer.disconnect();
      });
    },
    { threshold: 0.25 },
  );

  observer.observe(section);
})();

/* =================================================================
   PRICING MOTION + 3D DEPTH CARDS
================================================================= */
(() => {
  const section = document.querySelector(".pricing-section");
  if (!section) return;

  const revealItems = section.querySelectorAll(".pricing-reveal");
  const cards = section.querySelectorAll(".pricing-card");

  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const px = x / rect.width - 0.5;
      const py = y / rect.height - 0.5;

      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
      // Flip/depth impression: the face tilts away from the cursor,
      // as if the card is being pressed into the page.
      card.style.setProperty("--ry", `${(-px * 12).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(py * 12).toFixed(2)}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--mouse-x", "50%");
      card.style.setProperty("--mouse-y", "50%");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.set(revealItems, { opacity: 0, y: 30 });
    gsap.to(revealItems, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.09,
      scrollTrigger: {
        trigger: section,
        start: "top 68%",
        once: true,
      },
      onComplete: () => {
        revealItems.forEach((el) => {
          el.style.filter = "none";
          el.style.webkitFilter = "none";
        });
      },
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealItems.forEach((item, index) => {
          setTimeout(() => item.classList.add("is-visible"), index * 80);
        });
        observer.disconnect();
      });
    },
    { threshold: 0.22 },
  );

  observer.observe(section);
})();

/* =================================================================
   FOOTER MOTION
================================================================= */
(() => {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;

  const revealItems = footer.querySelectorAll(".footer-reveal");
  const cta = footer.querySelector(".footer-cta");
  const form = footer.querySelector(".footer-form");

  cta?.addEventListener("pointermove", (event) => {
    const rect = cta.getBoundingClientRect();
    cta.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    cta.style.setProperty("--my", `${event.clientY - rect.top}px`);
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    if (!button) return;
    const original = button.textContent;
    button.textContent = "Na lista";
    setTimeout(() => {
      button.textContent = original;
    }, 1800);
  });

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.set(revealItems, { opacity: 0, y: 28, filter: "blur(12px)" });
    gsap.to(revealItems, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: {
        trigger: footer,
        start: "top 72%",
        once: true,
      },
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealItems.forEach((item, index) => {
          setTimeout(() => item.classList.add("is-visible"), index * 80);
        });
        observer.disconnect();
      });
    },
    { threshold: 0.18 },
  );

  observer.observe(footer);
})();
