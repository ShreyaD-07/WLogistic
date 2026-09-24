const SCENES = [
  {
    id: 1,
    frames: 240,
    kicker: "Orbital network",
    title: "Every lane on Earth,<br />in one signal.",
    copy: "Scroll to fly the WithX telemetry globe — trade routes lighting up as the camera drops from orbit toward India.",
  },
  {
    id: 2,
    frames: 240,
    kicker: "Command hub",
    title: "The campus that<br />never sleeps.",
    copy: "Night operations at the WithX logistics hub: docks, cranes, and a fleet staged for continuous dispatch.",
  },
  {
    id: 3,
    frames: 240,
    kicker: "Intelligent sort",
    title: "Zero-touch<br />fulfillment.",
    copy: "Robot arms, scan tunnels, and conveyor flow — each parcel identified, routed, and released in motion.",
  },
  {
    id: 4,
    frames: 240,
    kicker: "Fleet dispatch",
    title: "Dock to highway<br />in one motion.",
    copy: "Loaded trailers leave the bay as WithX trucks take the wet tarmac toward the next city.",
  },
  {
    id: 5,
    frames: 240,
    kicker: "India super-network",
    title: "A country drawn<br />in freight.",
    copy: "Live corridors between Delhi, Mumbai, Pune, Bengaluru, Chennai, and Kolkata — the night network, visualized.",
  },
  {
    id: 6,
    frames: 300,
    kicker: "Ocean gateways",
    title: "From quay to<br />open water.",
    copy: "Cranes, containers, and WithX vessels — cargo leaves the terminal for sea.",
  },
  {
    id: 8,
    frames: 240,
    kicker: "Air network",
    title: "Then the sky<br />takes over.",
    copy: "Orbit to runway: WithX cargo aircraft lift the same freight into the global air lane.",
  },
];

const TOTAL_FRAMES = SCENES.reduce((sum, scene) => sum + scene.frames, 0);
const START_OFFSETS = SCENES.map((_, i) => SCENES.slice(0, i).reduce((sum, scene) => sum + scene.frames, 0));
const VERSION = "6";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
const track = document.getElementById("scroll-track");
const film = document.getElementById("film");
const about = document.getElementById("about");
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loader-fill");
const loaderPct = document.getElementById("loader-pct");
const kickerEl = document.getElementById("kicker");
const headlineEl = document.getElementById("headline");
const copyEl = document.getElementById("copy");
const hud = document.getElementById("hud");
const hint = document.getElementById("hint");
const vignette = document.querySelector(".vignette");
const topbar = document.querySelector(".topbar");

const cache = new Map();
const inflight = new Map();
let currentIndex = 0;
let displayIndex = 0;
let paintedIndex = -1;
let activeScene = 0;
let started = false;
let ticking = false;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pad(n) {
  return String(n).padStart(3, "0");
}

function frameUrl(sceneId, frameNo) {
  return `frames/scene${sceneId}/ezgif-frame-${pad(frameNo)}.jpg?v=${VERSION}`;
}

function locate(globalIndex) {
  let remaining = Math.max(0, Math.min(TOTAL_FRAMES - 1, globalIndex | 0));
  for (let i = 0; i < SCENES.length; i += 1) {
    if (remaining < SCENES[i].frames) {
      return { scene: i, frame: remaining + 1, sceneId: SCENES[i].id };
    }
    remaining -= SCENES[i].frames;
  }
  const last = SCENES[SCENES.length - 1];
  return { scene: SCENES.length - 1, frame: last.frames, sceneId: last.id };
}

function loadImage(url) {
  if (cache.has(url)) return Promise.resolve(cache.get(url));
  if (inflight.has(url)) return inflight.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const ready = img.decode ? img.decode() : Promise.resolve();
      ready
        .catch(() => {})
        .then(() => {
          cache.set(url, img);
          inflight.delete(url);
          resolve(img);
        });
    };
    img.onerror = () => {
      inflight.delete(url);
      reject(new Error(url));
    };
    img.src = url;
  });
  inflight.set(url, p);
  return p;
}

function prefetchWindow(center, radius = 48) {
  for (let i = 0; i <= radius; i += 1) {
    const ahead = Math.min(TOTAL_FRAMES - 1, center + i);
    const behind = Math.max(0, center - i);
    const a = locate(ahead);
    const b = locate(behind);
    loadImage(frameUrl(a.sceneId, a.frame)).catch(() => {});
    if (i) loadImage(frameUrl(b.sceneId, b.frame)).catch(() => {});
  }
}

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  paintedIndex = -1;
  drawFrame(displayIndex);
}

function drawCover(img) {
  const w = canvas.width;
  const h = canvas.height;
  const ir = img.width / img.height;
  const cr = w / h;
  let dw;
  let dh;
  let dx;
  let dy;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
    dy = 0;
  } else {
    dw = w;
    dh = w / ir;
    dx = 0;
    dy = (h - dh) / 2;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#05070d";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function nearestCached(index) {
  const loc = locate(index);
  const exact = frameUrl(loc.sceneId, loc.frame);
  if (cache.has(exact)) return cache.get(exact);
  for (let d = 1; d < 8; d += 1) {
    const a = locate(Math.max(0, index - d));
    const ua = frameUrl(a.sceneId, a.frame);
    if (cache.has(ua)) return cache.get(ua);
  }
  return null;
}

function drawFrame(index) {
  const frame = Math.round(index);
  if (frame === paintedIndex && paintedIndex !== -1) return;
  const img = nearestCached(frame);
  if (!img) return;
  drawCover(img);
  paintedIndex = frame;
}

function setHud(sceneIndex) {
  const scene = SCENES[sceneIndex];
  hud.classList.add("is-swap");
  window.setTimeout(() => {
    kickerEl.textContent = scene.kicker;
    headlineEl.innerHTML = scene.title;
    copyEl.textContent = scene.copy;
    hud.classList.remove("is-swap");
  }, 120);
}

function layoutScroll() {
  const perFrame = window.innerWidth < 720 ? 10 : 12;
  track.style.height = `${window.innerHeight + TOTAL_FRAMES * perFrame}px`;
}

function filmMax() {
  return Math.max(1, film.offsetHeight - window.innerHeight);
}

function syncFromScroll() {
  const max = filmMax();
  const progress = Math.min(1, Math.max(0, window.scrollY / max));
  currentIndex = Math.round(progress * (TOTAL_FRAMES - 1));
  const loc = locate(currentIndex);
  if (loc.scene !== activeScene) {
    activeScene = loc.scene;
    setHud(activeScene);
  }
  const pastFilm = window.scrollY > max - 8;
  hud.classList.toggle("is-away", pastFilm);
  hint.classList.toggle("is-away", pastFilm);
  vignette.classList.toggle("is-away", pastFilm);
  topbar.classList.toggle("is-light", pastFilm);
  hint.classList.toggle("is-gone", window.scrollY > 40);
  if (pastFilm) about.classList.add("is-in");
  prefetchWindow(currentIndex, 64);
}

function onScroll() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(() => {
      syncFromScroll();
      ticking = false;
    });
  }
}

function tick() {
  const target = currentIndex;
  const diff = target - displayIndex;
  if (reduced) {
    displayIndex = target;
  } else {
    const step = Math.abs(diff) > 30 ? 4 : Math.abs(diff) > 8 ? 2 : 1;
    if (Math.abs(diff) < 0.5) displayIndex = target;
    else displayIndex += Math.sign(diff) * Math.min(Math.abs(diff), step);
  }
  drawFrame(displayIndex);
  requestAnimationFrame(tick);
}

function jumpToScene(sceneIndex) {
  layoutScroll();
  const start = START_OFFSETS[sceneIndex] ?? 0;
  const y = (start / Math.max(1, TOTAL_FRAMES - 1)) * filmMax() + 2;
  window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  currentIndex = start;
  displayIndex = start;
  paintedIndex = -1;
  syncFromScroll();
}

topbar.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-scene]");
  if (!btn) return;
  event.preventDefault();
  jumpToScene(Number(btn.dataset.scene));
});

document.querySelectorAll('a[href="#about"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    about.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
});

document.querySelectorAll('a[href="#contact"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("contact").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
});

document.querySelector(".logo").addEventListener("click", (event) => {
  event.preventDefault();
  jumpToScene(0);
});

const aboutWatch = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) about.classList.add("is-in");
    });
  },
  { threshold: 0.28 }
);
aboutWatch.observe(about);

async function preloadAll() {
  const jobs = [];
  SCENES.forEach((scene) => {
    for (let f = 1; f <= scene.frames; f += 1) {
      jobs.push(() => loadImage(frameUrl(scene.id, f)));
    }
  });
  let cursor = 0;
  const workers = 6;
  async function worker() {
    while (cursor < jobs.length) {
      const i = cursor;
      cursor += 1;
      try {
        await jobs[i]();
      } catch {
        /* skip missing frame */
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
}

async function boot() {
  layoutScroll();
  sizeCanvas();

  const firstWave = [];
  for (let f = 1; f <= 60; f += 1) firstWave.push(loadImage(frameUrl(1, f)));
  SCENES.forEach((scene) => firstWave.push(loadImage(frameUrl(scene.id, 1))));

  let done = 0;
  await Promise.all(
    firstWave.map((p) =>
      p
        .then(() => {
          done += 1;
          const pct = Math.round((done / firstWave.length) * 100);
          loaderFill.style.width = `${pct}%`;
          loaderPct.textContent = `${pct}%`;
        })
        .catch(() => {
          done += 1;
        })
    )
  );

  currentIndex = 0;
  displayIndex = 0;
  drawFrame(0);
  setHud(0);
  loader.classList.add("is-done");
  started = true;
  prefetchWindow(0, 80);
  syncFromScroll();
  requestAnimationFrame(tick);
  preloadAll();
}

window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", () => {
  layoutScroll();
  sizeCanvas();
  if (started) syncFromScroll();
});

boot();

/* ============================
   Get in touch + footer
   ============================ */
const contactSection = document.getElementById("contact");

if (contactSection) {
  const contactWatch = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) contactSection.classList.add("is-in");
      });
    },
    { threshold: 0.22 }
  );
  contactWatch.observe(contactSection);
}

document.querySelectorAll('a[href="#contact"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    contactSection?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
});

const contactForm = document.getElementById("contact-form");
const formNote = document.getElementById("form-note");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.checkValidity()) {
      if (formNote) formNote.textContent = "Please fill in the required fields.";
      return;
    }
    const name = contactForm.querySelector("#cf-name")?.value?.trim();
    if (formNote) {
      formNote.textContent = `Thanks${name ? ", " + name : ""} — our team will reach out shortly.`;
    }
    contactForm.reset();
  });
}

const footerYear = document.getElementById("footer-year");
if (footerYear) footerYear.textContent = new Date().getFullYear();
// ========================================
// WITHX CONTACT FORM
// ========================================

const contactForm = document.getElementById("contact-form");
const formNote = document.getElementById("form-note");

if (contactForm) {
  contactForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const submitButton = contactForm.querySelector(".form-submit");

    const name = document.getElementById("cf-name").value.trim();
    const email = document.getElementById("cf-email").value.trim();
    const message = document.getElementById("cf-message").value.trim();

    if (!name || !email || !message) {
      formNote.textContent = "Please fill in all required fields.";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    formNote.textContent = "";

    const formData = new FormData(contactForm);

    try {
      const response = await fetch(
        "https://api.web3forms.com/submit",
        {
          method: "POST",
          body: formData
        }
      );

      const result = await response.json();

      if (result.success) {
        formNote.textContent =
          "Message sent successfully. We will get back to you soon.";

        contactForm.reset();

        submitButton.textContent = "Message sent";

        setTimeout(() => {
          submitButton.disabled = false;
          submitButton.textContent = "Send message";
        }, 3000);

      } else {
        throw new Error(result.message || "Something went wrong.");
      }

    } catch (error) {
      console.error("Contact form error:", error);

      formNote.textContent =
        "Unable to send your message. Please try again.";

      submitButton.disabled = false;
      submitButton.textContent = "Send message";
    }
  });
}
