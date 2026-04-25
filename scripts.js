/* =================================================================
   SMOOTH INTERNAL NAVIGATION
================================================================= */
(() => {
  const navHeight = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
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
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      smoothScrollTo(target);
      history.pushState(null, '', href);
    });
  });
})();

/* =================================================================
   SCROLL-DRIVEN HERO · GSAP ScrollTrigger
   -----------------------------------------------------------------
   Context7/GSAP docs recommend linking animation progress to scroll
   with ScrollTrigger `scrub`. Here GSAP owns the video playhead:
   scroll progress -> video.currentTime. If the CDN is unavailable,
   a small requestAnimationFrame fallback keeps the same behaviour.
================================================================= */
(() => {
  const hero        = document.getElementById('hero');
  const video       = document.getElementById('heroVideo');
  const heroText    = document.getElementById('heroText');
  const heroSide    = document.getElementById('heroSide');
  const heroCue     = document.getElementById('heroCue');
  const heroPercent = document.getElementById('heroPercent');
  const heroRuntime = document.getElementById('heroRuntime');
  const nav         = document.getElementById('nav');

  if (!hero || !video) return;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const pad = (n) => String(Math.floor(n)).padStart(2, '0');
  const formatTime = (secs) => {
    if (!isFinite(secs)) return '00:00';
    return `${pad(secs / 60)}:${pad(secs % 60)}`;
  };

  let duration = 0;
  let targetTime = 0.001;
  let smoothTime = 0.001;
  let lastSeekAt = 0;
  let fallbackRaf = 0;
  let initialized = false;

  // Seeking every scroll tick is the main source of stutter. The
  // scroll animation only sets targetTime; this loop eases toward it
  // and caps actual video seeks to a browser-friendly cadence.
  const VIDEO_LERP = 0.28;
  const MIN_SEEK_INTERVAL = 1000 / 30;
  const SEEK_EPSILON = 0.024;

  function setChrome(progress) {
    const p = clamp(progress, 0, 1);
    const textP = clamp((p - 0.06) / (0.55 - 0.06), 0, 1);
    const docScrollable = document.documentElement.scrollHeight - window.innerHeight;
    const docProgress = docScrollable > 0 ? window.scrollY / docScrollable : 0;

    document.documentElement.style.setProperty('--scroll-progress', docProgress.toFixed(4));
    heroText.style.setProperty('--p', textP.toFixed(3));
    heroSide.style.setProperty('--p', textP.toFixed(3));
    heroCue.style.setProperty('--p', p.toFixed(3));
    heroPercent.textContent = pad(p * 100) + '%';
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  function heroProgress() {
    const rect = hero.getBoundingClientRect();
    const scrollable = hero.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return clamp(-rect.top / scrollable, 0, 1);
  }

  function seekVideo(time, force = false) {
    if (!duration || !Number.isFinite(time)) return;
    const nextTime = clamp(time, 0.001, Math.max(0.001, duration - 0.04));
    const now = performance.now();

    // Avoid excessive seeks for tiny scroll deltas. This helps Chrome
    // keep decode work predictable while preserving visual sync.
    if (
      force ||
      (now - lastSeekAt >= MIN_SEEK_INTERVAL && Math.abs(video.currentTime - nextTime) > SEEK_EPSILON)
    ) {
      try { video.currentTime = nextTime; } catch (_) {}
      lastSeekAt = now;
    }
  }

  function renderVideoPlayhead() {
    smoothTime += (targetTime - smoothTime) * VIDEO_LERP;
    seekVideo(smoothTime);
  }

  function setupScrollTrigger() {
    if (initialized) return;
    initialized = true;

    duration = video.duration || 0;
    heroRuntime.textContent = formatTime(duration);
    targetTime = 0.001;
    smoothTime = 0.001;
    seekVideo(0.001, true);

    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      const playhead = { time: 0.001 };

      gsap.to(playhead, {
        time: Math.max(0.001, duration - 0.04),
        ease: 'none',
        onUpdate: () => {
          targetTime = playhead.time;
        },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.55,
          invalidateOnRefresh: true,
          onUpdate: (self) => setChrome(self.progress)
        }
      });

      gsap.ticker.add(renderVideoPlayhead);
      ScrollTrigger.refresh();
      return;
    }

    // Fallback when GSAP CDN is not available: rAF-driven scroll scrub.
    let smoothed = 0;
    const tick = () => {
      const target = heroProgress();
      smoothed += (target - smoothed) * 0.22;
      targetTime = smoothed * duration;
      renderVideoPlayhead();
      setChrome(smoothed);

      if (Math.abs(target - smoothed) > 0.001) {
        fallbackRaf = requestAnimationFrame(tick);
      } else {
        fallbackRaf = 0;
      }
    };

    const requestTick = () => {
      if (!fallbackRaf) fallbackRaf = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick);
    requestTick();
  }

  // Prime decoding without letting the video autoplay normally.
  function primeVideo() {
    const p = video.play();
    if (p && typeof p.then === 'function') {
      p.then(() => video.pause()).catch(() => {});
    } else {
      try { video.pause(); } catch (_) {}
    }
  }

  if (video.readyState >= 1) {
    setupScrollTrigger();
  } else {
    video.addEventListener('loadedmetadata', setupScrollTrigger, { once: true });
  }
  video.addEventListener('loadeddata', () => seekVideo(0.001), { once: true });
  video.addEventListener('error', () => {
    console.warn('[hero] video failed to load. Check assets/Bottle_morphs_into_202604181256.mp4', video.error);
  });

  try { video.load(); } catch (_) {}
  primeVideo();

  const unlock = () => {
    primeVideo();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('scroll', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('scroll', unlock, { passive: true });

  setChrome(0);
})();

/* =================================================================
   PRODUCT SECTION MOTION
================================================================= */
(() => {
  const section = document.querySelector('.product-section');
  if (!section) return;

  const productVisual = section.querySelector('.product-visual');
  const revealItems = section.querySelectorAll('.product-reveal:not(.product-visual)');
  const photoCard = document.getElementById('productPhotoCard');
  const photo = document.getElementById('productPhoto');

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.set(revealItems, { opacity: 0, y: 28, filter: 'blur(12px)' });
    gsap.set(productVisual, { opacity: 0, x: '-24vw', y: 42, rotate: -8, filter: 'blur(18px)' });
    gsap.set(photoCard, { rotate: -5, scale: 0.94 });
    gsap.set(photo, { scale: 1.18, xPercent: -6 });

    const productIntro = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 68%',
        once: true
      }
    });

    productIntro
      .to(productVisual, {
        opacity: 1,
        x: 0,
        y: 0,
        rotate: 0,
        filter: 'blur(0px)',
        duration: 1.35,
        ease: 'expo.out'
      })
      .to(photoCard, {
        rotate: 0,
        scale: 1,
        duration: 1.1,
        ease: 'elastic.out(1, 0.78)'
      }, '-=1.05')
      .to(photo, {
        xPercent: 0,
        scale: 1.08,
        duration: 1.25,
        ease: 'power3.out'
      }, '-=1.15')
      .to(revealItems, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08
      }, '-=0.55');

    gsap.fromTo(photoCard,
      { y: 56 },
      {
        y: -36,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8
        }
      }
    );

    gsap.fromTo(photo,
      { yPercent: -3 },
      {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8
        }
      }
    );

    section.querySelectorAll('.benefit-card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        card.style.setProperty('--mx', `${x}px`);
        card.style.setProperty('--my', `${y}px`);
      });
    });

    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      productVisual.classList.add('is-visible');
      revealItems.forEach((item, index) => {
        setTimeout(() => item.classList.add('is-visible'), index * 80);
      });
      observer.disconnect();
    });
  }, { threshold: 0.22 });

  observer.observe(section);
})();

/* =================================================================
   RED FEATURE MOTION
================================================================= */
(() => {
  const section = document.querySelector('.red-feature');
  if (!section) return;

  const revealItems = section.querySelectorAll('.red-reveal');
  const bottleVisual = document.getElementById('redBottleVisual');
  const bottle = document.getElementById('featureBottle');
  const stats = section.querySelectorAll('.red-stat-number');

  function animateStats() {
    stats.forEach((stat) => {
      if (stat.dataset.done) return;
      stat.dataset.done = 'true';
      const target = Number(stat.dataset.count || 0);
      const suffix = stat.querySelector('span')?.outerHTML || '';
      const obj = { value: 0 };

      if (window.gsap) {
        gsap.to(obj, {
          value: target,
          duration: 1.5,
          ease: 'power3.out',
          onUpdate: () => {
            stat.innerHTML = `${Math.round(obj.value)}${suffix}`;
          }
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

    gsap.set(revealItems, { opacity: 0, y: 30, filter: 'blur(12px)' });
    gsap.set(bottleVisual, { opacity: 0, x: '22vw', rotate: 8, scale: 0.84, filter: 'blur(18px)' });
    gsap.set(bottle, { y: 42, rotate: -5, scale: 0.96 });

    const intro = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 66%',
        once: true,
        onEnter: animateStats
      }
    });

    intro
      .to(bottleVisual, {
        opacity: 1,
        x: 0,
        rotate: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 1.25,
        ease: 'expo.out'
      })
      .to(bottle, {
        y: 0,
        rotate: 0,
        scale: 1,
        duration: 1.15,
        ease: 'elastic.out(1, 0.7)'
      }, '-=1.05')
      .to(revealItems, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.86,
        ease: 'power3.out',
        stagger: 0.08
      }, '-=0.62');

    gsap.to(bottle, {
      y: -18,
      rotate: 1.4,
      duration: 2.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });

    gsap.fromTo(bottleVisual,
      { y: 56 },
      {
        y: -44,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.9
        }
      }
    );

    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      bottleVisual?.classList.add('is-visible');
      revealItems.forEach((item, index) => {
        setTimeout(() => item.classList.add('is-visible'), index * 80);
      });
      animateStats();
      observer.disconnect();
    });
  }, { threshold: 0.25 });

  observer.observe(section);
})();

/* =================================================================
   PRICING MOTION + 3D DEPTH CARDS
================================================================= */
(() => {
  const section = document.querySelector('.pricing-section');
  if (!section) return;

  const revealItems = section.querySelectorAll('.pricing-reveal');
  const cards = section.querySelectorAll('.pricing-card');

  cards.forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const px = x / rect.width - 0.5;
      const py = y / rect.height - 0.5;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
      // Flip/depth impression: the face tilts away from the cursor,
      // as if the card is being pressed into the page.
      card.style.setProperty('--ry', `${(-px * 12).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(py * 12).toFixed(2)}deg`);
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--mouse-x', '50%');
      card.style.setProperty('--mouse-y', '50%');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.set(revealItems, { opacity: 0, y: 30, filter: 'blur(12px)' });
    gsap.to(revealItems, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.09,
      scrollTrigger: {
        trigger: section,
        start: 'top 68%',
        once: true
      }
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      revealItems.forEach((item, index) => {
        setTimeout(() => item.classList.add('is-visible'), index * 80);
      });
      observer.disconnect();
    });
  }, { threshold: 0.22 });

  observer.observe(section);
})();

/* =================================================================
   FOOTER MOTION
================================================================= */
(() => {
  const footer = document.querySelector('.site-footer');
  if (!footer) return;

  const revealItems = footer.querySelectorAll('.footer-reveal');
  const cta = footer.querySelector('.footer-cta');
  const form = footer.querySelector('.footer-form');

  cta?.addEventListener('pointermove', (event) => {
    const rect = cta.getBoundingClientRect();
    cta.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    cta.style.setProperty('--my', `${event.clientY - rect.top}px`);
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const button = form.querySelector('button');
    if (!button) return;
    const original = button.textContent;
    button.textContent = 'Na lista';
    setTimeout(() => { button.textContent = original; }, 1800);
  });

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.set(revealItems, { opacity: 0, y: 28, filter: 'blur(12px)' });
    gsap.to(revealItems, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: footer,
        start: 'top 72%',
        once: true
      }
    });
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      revealItems.forEach((item, index) => {
        setTimeout(() => item.classList.add('is-visible'), index * 80);
      });
      observer.disconnect();
    });
  }, { threshold: 0.18 });

  observer.observe(footer);
})();
