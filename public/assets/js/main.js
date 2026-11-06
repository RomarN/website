/**
 * romar.nathoe.nl — interactie
 * Geen dependencies. Elke feature is een losse init-functie.
 */
import { init_contours } from './contours.js';
import { init_palette } from './palette.js';
import { init_pace_calculator } from './pace.js';
import { init_countdown } from './countdown.js';
import { init_race_chart } from './races.js';

const reduced_motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine_pointer = matchMedia('(pointer: fine)').matches;
const geboortedatum = new Date(1998, 8, 3);
const email = 'contact@nathoe.nl';

/**
 * Korte querySelectorAll die een array teruggeeft
 * @param {string} selector
 * @param {ParentNode} root
 * @returns {HTMLElement[]}
 */
function select_all (selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/* ------------------------------------------------------------------ */
/* Thema                                                              */
/* ------------------------------------------------------------------ */

/**
 * Wisselt licht/donker thema met een cirkel-reveal via de View Transitions API
 * @param {{x: number, y: number}} [origin] - Startpunt van de cirkel in viewport-pixels
 * @returns {void}
 */
export function toggle_theme (origin) {
  const root = document.documentElement;
  const next_theme = root.dataset.theme == 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next_theme;
    localStorage.setItem('theme', next_theme);
  };

  if (document.startViewTransition == null || reduced_motion == true) {
    apply();
    return;
  }

  const x = origin?.x ?? innerWidth - 40;
  const y = origin?.y ?? 40;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(apply);
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  });
}

/**
 * Koppelt de thema-knoppen
 * @returns {void}
 */
function init_theme_toggle () {
  select_all('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const rect = button.getBoundingClientRect();
      // Toetsenbord-klik heeft clientX 0: dan vanuit midden van de knop
      const x = event.clientX > 0 ? event.clientX : rect.left + rect.width / 2;
      const y = event.clientY > 0 ? event.clientY : rect.top + rect.height / 2;
      toggle_theme({ x, y });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Navigatie                                                          */
/* ------------------------------------------------------------------ */

/**
 * Nav verbergen bij omlaag scrollen, en scroll-spy met view transition op de actieve pill
 * @returns {void}
 */
function init_nav () {
  const nav = document.querySelector('[data-nav]');
  let last_y = scrollY;

  addEventListener('scroll', () => {
    const y = scrollY;
    nav.toggleAttribute('data-scrolled', y > 20);
    nav.toggleAttribute('data-hidden', y > last_y && y > 400 && nav.matches(':focus-within') == false);
    last_y = y;
  }, { passive: true });

  const nav_links = new Map(select_all('.nav__links a').map((link) => [link.hash.slice(1), link]));
  // Bewust geen View Transition hier: die maakt tijdens het scrollen een snapshot van de hele pagina (stotter op mobiel)
  const set_active = (section_id) => {
    nav_links.forEach((link, key) => link.setAttribute('aria-current', String(key == section_id)));
  };

  let current_id = null;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting == true && entry.target.id != current_id) {
        current_id = entry.target.id;
        set_active(nav_links.has(current_id) ? current_id : null);
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });

  select_all('main section[id]').forEach((section) => observer.observe(section));
}

/* ------------------------------------------------------------------ */
/* Reveal on scroll                                                   */
/* ------------------------------------------------------------------ */

/**
 * Zet data-visible op elementen zodra ze in beeld komen, met stagger per parent
 * @returns {void}
 */
function init_reveal () {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting == false) continue;
      const element = entry.target;
      element.setAttribute('data-visible', '');
      observer.unobserve(element);
      // Delay weghalen na reveal, anders voelen hover-transities traag
      setTimeout(() => { element.style.transitionDelay = ''; }, 1500);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  const stagger_per_parent = new Map();
  select_all('.reveal, .card, .tile').forEach((element) => {
    const index = stagger_per_parent.get(element.parentElement) ?? 0;
    stagger_per_parent.set(element.parentElement, index + 1);
    element.style.transitionDelay = `${Math.min(index, 6) * 70}ms`;
    observer.observe(element);
  });
}

/* ------------------------------------------------------------------ */
/* Leeftijd, klok, jaartal                                            */
/* ------------------------------------------------------------------ */

/**
 * Berekent leeftijd op een gegeven datum
 * @param {Date} datum
 * @returns {number}
 */
function get_leeftijd (datum) {
  const leeftijd = datum.getFullYear() - geboortedatum.getFullYear();
  const zelfde_maand = datum.getMonth() == geboortedatum.getMonth();
  const voor_verjaardag = datum.getMonth() < geboortedatum.getMonth()
    || (zelfde_maand == true && datum.getDate() < geboortedatum.getDate());
  return voor_verjaardag == true ? leeftijd - 1 : leeftijd;
}

/**
 * Vult leeftijd, jaartal en lokale tijd (Europe/Amsterdam)
 * @returns {void}
 */
function init_live_data () {
  const nu = new Date();
  select_all('[data-age]').forEach((element) => { element.textContent = get_leeftijd(nu); });
  select_all('[data-year]').forEach((element) => { element.textContent = nu.getFullYear(); });

  const klok = document.querySelector('[data-clock]');
  const tijd_format = new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam'
  });
  const tick = () => { klok.textContent = tijd_format.format(new Date()); };
  tick();
  setInterval(tick, 10_000);
}

/* ------------------------------------------------------------------ */
/* Hero: woorden-rotator en tekst-scramble                            */
/* ------------------------------------------------------------------ */

/**
 * Wisselt elke paar seconden het uitgelichte woord in de hero
 * @returns {void}
 */
function init_rotator () {
  const woorden = select_all('[data-rotator] > span');
  let index = 0;
  woorden[0].setAttribute('data-active', '');
  if (reduced_motion == true) return;

  setInterval(() => {
    const vorige = woorden[index];
    index = (index + 1) % woorden.length;
    vorige.removeAttribute('data-active');
    vorige.setAttribute('data-leaving', '');
    woorden[index].removeAttribute('data-leaving');
    woorden[index].setAttribute('data-active', '');
    setTimeout(() => vorige.removeAttribute('data-leaving'), 700);
  }, 2400);
}

/**
 * Hacker-achtige scramble van tekst bij hover
 * @returns {void}
 */
function init_scramble () {
  const glyphs = '!<>-_\\/[]{}=+*^?#01';
  select_all('[data-scramble]').forEach((element) => {
    const origineel = element.textContent;
    const host = element.closest('a') ?? element;
    let raf_id = 0;

    host.addEventListener('mouseenter', () => {
      if (reduced_motion == true) return;
      cancelAnimationFrame(raf_id);
      let frame = 0;
      const step = () => {
        element.textContent = [...origineel].map((char, i) => {
          if (char == ' ' || i < frame / 2) return char;
          return glyphs[Math.floor(Math.random() * glyphs.length)];
        }).join('');
        frame += 1;
        if (frame / 2 <= origineel.length) {
          raf_id = requestAnimationFrame(step);
        } else {
          element.textContent = origineel;
        }
      };
      step();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Pointer-effecten                                                   */
/* ------------------------------------------------------------------ */

/**
 * Spotlight op kaarten: cursorpositie als CSS custom properties
 * @returns {void}
 */
function init_spotlight () {
  document.addEventListener('pointermove', (event) => {
    const target = event.target.closest?.('[data-spotlight]');
    if (target == null) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    target.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }, { passive: true });
}

/**
 * Knoppen bewegen licht mee met de cursor
 * @returns {void}
 */
function init_magnetic () {
  select_all('[data-magnetic]').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      element.style.translate = `${dx * 0.18}px ${dy * 0.3}px`;
    });
    element.addEventListener('pointerleave', () => { element.style.translate = ''; });
  });
}

/**
 * 3D-tilt en glans op de hero-foto
 * @returns {void}
 */
function init_tilt () {
  const foto = document.querySelector('[data-tilt]');
  if (foto == null) return;

  foto.addEventListener('pointermove', (event) => {
    const rect = foto.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    foto.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
    foto.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
    foto.style.setProperty('--gx', `${px * 100}%`);
    foto.style.setProperty('--gy', `${py * 100}%`);
  });
  foto.addEventListener('pointerleave', () => {
    ['--rx', '--ry', '--gx', '--gy'].forEach((prop) => foto.style.removeProperty(prop));
  });
}

/**
 * Focuspunt van de camerazoeker volgt de cursor
 * @returns {void}
 */
function init_viewfinder () {
  const tile = document.querySelector('.tile--photo');
  const focus = document.querySelector('.vf-focus');
  if (tile == null || focus == null) return;

  tile.addEventListener('pointermove', (event) => {
    const rect = focus.parentElement.getBoundingClientRect();
    const fx = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0.12), 0.88);
    const fy = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0.18), 0.82);
    focus.style.setProperty('--fx', `${fx * 100}%`);
    focus.style.setProperty('--fy', `${fy * 100}%`);
  });
}

/**
 * Alle pointer-effecten, alleen bij muis/trackpad
 * @returns {void}
 */
function init_pointer_effects () {
  if (fine_pointer == false) return;
  init_spotlight();
  if (reduced_motion == true) return;
  init_magnetic();
  init_tilt();
  init_viewfinder();
}

/* ------------------------------------------------------------------ */
/* Tellers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Bepaalt de eindwaarde en suffix van een teller-element
 * @param {HTMLElement} element
 * @returns {{waarde: number, suffix: string}}
 */
function get_teller_doel (element) {
  const sinds = element.dataset.countSince;
  if (sinds != null) {
    return { waarde: new Date().getFullYear() - Number(sinds), suffix: element.dataset.suffix ?? '+' };
  }
  return { waarde: Number(element.dataset.count), suffix: element.dataset.suffix ?? '' };
}

/**
 * Telt een getal op met ease-out zodra het in beeld komt
 * @returns {void}
 */
function init_counters () {
  const animeer = (element) => {
    const { waarde, suffix } = get_teller_doel(element);
    if (reduced_motion == true) {
      element.textContent = `${waarde}${suffix}`;
      return;
    }
    const start = performance.now();
    const duur = 1400;
    const frame = (nu) => {
      const t = Math.min((nu - start) / duur, 1);
      const eased = 1 - (1 - t) ** 4;
      element.textContent = `${Math.round(waarde * eased)}${t == 1 ? suffix : ''}`;
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting == false) continue;
      animeer(entry.target);
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.6 });
  select_all('[data-count], [data-count-since]').forEach((element) => observer.observe(element));
}

/* ------------------------------------------------------------------ */
/* Stack-filter                                                       */
/* ------------------------------------------------------------------ */

/**
 * Filtert de stack-grid op categorie; niet-matchende items worden gedimd
 * @returns {void}
 */
function init_stack_filter () {
  const tabs = select_all('[data-filter]');
  const items = select_all('[data-stack] li');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const filter = tab.dataset.filter;
      tabs.forEach((andere_tab) => andere_tab.setAttribute('aria-selected', String(andere_tab == tab)));
      items.forEach((item) => {
        const match = filter == 'all' || item.dataset.cat.split(' ').includes(filter);
        item.toggleAttribute('data-dim', match == false);
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Simrace rondetijd                                                  */
/* ------------------------------------------------------------------ */

/**
 * Formatteert seconden als m:ss.mmm
 * @param {number} seconden
 * @returns {string}
 */
function format_rondetijd (seconden) {
  const minuten = Math.floor(seconden / 60);
  return `${minuten}:${(seconden - minuten * 60).toFixed(3).padStart(6, '0')}`;
}

/**
 * Simuleert nieuwe rondetijden; paars bij persoonlijk record (zoals in de sim)
 * @returns {void}
 */
function init_lap_timer () {
  const element = document.querySelector('[data-laptime]');
  if (element == null || reduced_motion == true) return;
  let beste_ronde = 102.318;
  setInterval(() => {
    const ronde = 101.6 + Math.random() * 1.6;
    element.textContent = format_rondetijd(ronde);
    element.toggleAttribute('data-best', ronde < beste_ronde);
    beste_ronde = Math.min(beste_ronde, ronde);
  }, 3200);
}

/* ------------------------------------------------------------------ */
/* Toast + e-mail kopiëren                                            */
/* ------------------------------------------------------------------ */
let toast_timer = 0;

/**
 * Toont een korte melding onderin beeld
 * @param {string} bericht
 * @returns {void}
 */
export function show_toast (bericht) {
  const element = document.querySelector('[data-toast]');
  element.textContent = bericht;
  element.setAttribute('data-show', '');
  clearTimeout(toast_timer);
  toast_timer = setTimeout(() => element.removeAttribute('data-show'), 2200);
}

/**
 * Kopieert het e-mailadres; valt terug op mailto als clipboard niet mag
 * @returns {Promise<void>}
 */
export async function copy_email () {
  try {
    await navigator.clipboard.writeText(email);
    show_toast('E-mailadres gekopieerd');
  } catch {
    location.href = `mailto:${email}`;
  }
}

/**
 * Koppelt kopieer-knoppen
 * @returns {void}
 */
function init_copy_email () {
  select_all('[data-copy-email]').forEach((button) => button.addEventListener('click', copy_email));
}

/**
 * Toont ⌘ i.p.v. Ctrl op Apple-apparaten
 * @returns {void}
 */
function init_mod_key () {
  const platform = navigator.userAgentData?.platform ?? navigator.platform;
  if (/Mac|iPhone|iPad/.test(platform) == false) return;
  select_all('[data-mod-key]').forEach((kbd) => { kbd.textContent = '⌘'; });
}

/* ------------------------------------------------------------------ */
init_theme_toggle();
init_nav();
init_reveal();
init_live_data();
init_rotator();
init_scramble();
init_pointer_effects();
init_counters();
init_stack_filter();
init_lap_timer();
init_copy_email();
init_mod_key();
init_pace_calculator();
init_countdown(reduced_motion);
init_race_chart();
init_contours(document.querySelector('[data-contours]'), { reduced_motion, is_licht: fine_pointer == false });
init_palette({ toggle_theme, copy_email, show_toast });
