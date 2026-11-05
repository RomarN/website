/**
 * Aftelklok naar de start van de marathon. Cijfers rollen in bij elke wissel.
 */

/**
 * Splitst een aantal milliseconden op in dagen, uren, minuten en seconden
 * @param {number} resterend_ms
 * @returns {{dagen: number, uren: number, minuten: number, seconden: number}}
 */
function split_tijd (resterend_ms) {
  const totaal_sec = Math.max(0, Math.floor(resterend_ms / 1000));
  return {
    dagen: Math.floor(totaal_sec / 86400),
    uren: Math.floor((totaal_sec % 86400) / 3600),
    minuten: Math.floor((totaal_sec % 3600) / 60),
    seconden: totaal_sec % 60
  };
}

/**
 * Zet de waarde van één eenheid neer als losse cijfers; alleen gewijzigde cijfers animeren
 * @param {HTMLElement} element
 * @param {string} tekst
 * @param {boolean} animeer
 * @returns {void}
 */
function render_cijfers (element, tekst, animeer) {
  const cijfers = [...element.children];
  if (cijfers.length != tekst.length) {
    element.replaceChildren(...[...tekst].map((char) => {
      const span = document.createElement('span');
      span.className = 'countdown__digit';
      span.textContent = char;
      return span;
    }));
    return;
  }

  cijfers.forEach((span, index) => {
    if (span.textContent == tekst[index]) return;
    span.textContent = tekst[index];
    if (animeer == true) {
      span.animate(
        [{ translate: '0 -55%', opacity: 0, filter: 'blur(4px)' }, { translate: '0 0', opacity: 1, filter: 'blur(0)' }],
        { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' }
      );
    }
  });
}

/**
 * Start de aftelklok
 * @param {boolean} reduced_motion
 * @returns {void}
 */
export function init_countdown (reduced_motion) {
  const root = document.querySelector('[data-countdown]');
  if (root == null) return;

  const start_ms = new Date(root.dataset.countdown).getTime();
  const notitie = document.querySelector('[data-countdown-note]');
  const eenheden = {
    dagen: root.querySelector('[data-unit="dagen"]'),
    uren: root.querySelector('[data-unit="uren"]'),
    minuten: root.querySelector('[data-unit="minuten"]'),
    seconden: root.querySelector('[data-unit="seconden"]')
  };
  let interval_id = 0;
  let is_zichtbaar = false;

  const tick = () => {
    const resterend_ms = start_ms - Date.now();
    if (resterend_ms <= 0) {
      root.setAttribute('data-finished', '');
      notitie.textContent = 'Startschot gegeven. Rennen!';
      Object.values(eenheden).forEach((element) => render_cijfers(element, '00', false));
      clearInterval(interval_id);
      return;
    }
    const tijd = split_tijd(resterend_ms);
    const animeer = reduced_motion == false && is_zichtbaar == true;
    render_cijfers(eenheden.dagen, String(tijd.dagen), animeer);
    render_cijfers(eenheden.uren, String(tijd.uren).padStart(2, '0'), animeer);
    render_cijfers(eenheden.minuten, String(tijd.minuten).padStart(2, '0'), animeer);
    render_cijfers(eenheden.seconden, String(tijd.seconden).padStart(2, '0'), animeer);
  };

  // Alleen animeren als de klok in beeld is; tellen gaat altijd door
  new IntersectionObserver(([entry]) => { is_zichtbaar = entry.isIntersecting; }).observe(root);

  tick();
  // Uitlijnen op de volle seconde zodat de klok niet "slipt" t.o.v. de systeemklok
  setTimeout(() => {
    tick();
    interval_id = setInterval(tick, 1000);
  }, 1000 - (Date.now() % 1000));
}
