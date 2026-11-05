/**
 * Staafgrafiek "tempo per km" op basis van de wedstrijdlijst in de HTML.
 * De lijst blijft de bron (en tabelweergave); de grafiek wordt er progressief uit opgebouwd.
 */

const schaal_max_sec = 7 * 60;
const ticks_sec = [0, 120, 240, 360];

/**
 * @typedef {Object} Wedstrijd
 * @property {string} label
 * @property {string} datum
 * @property {string} eindtijd
 * @property {number} tempo_sec - Seconden per kilometer
 */

/**
 * Formatteert seconden per km als m:ss
 * @param {number} seconden
 * @returns {string}
 */
function format_tempo (seconden) {
  const afgerond = Math.round(seconden);
  return `${Math.floor(afgerond / 60)}:${String(afgerond % 60).padStart(2, '0')}`;
}

/**
 * Leest de wedstrijden uit de lijst, oudste eerst
 * @param {HTMLElement} lijst
 * @returns {Wedstrijd[]}
 */
function lees_wedstrijden (lijst) {
  return [...lijst.querySelectorAll('.race')].map((item) => ({
    label: item.dataset.label,
    datum: item.querySelector('time').textContent,
    eindtijd: item.querySelector('.race__time').textContent,
    tempo_sec: Number(item.dataset.seconds) / Number(item.dataset.km)
  })).reverse();
}

/**
 * Positie op de x-as als percentage
 * @param {number} tempo_sec
 * @returns {string}
 */
function x_positie (tempo_sec) {
  return `${(tempo_sec / schaal_max_sec) * 100}%`;
}

/**
 * Bouwt één rij van de grafiek
 * @param {Wedstrijd} wedstrijd
 * @param {number} index
 * @returns {HTMLElement}
 */
function maak_rij (wedstrijd, index) {
  const rij = document.createElement('div');
  rij.className = 'pace-chart__row';
  rij.tabIndex = 0;
  rij.dataset.index = index;
  rij.style.setProperty('--x', x_positie(wedstrijd.tempo_sec));
  rij.style.setProperty('--delay', `${index * 120}ms`);

  const label = document.createElement('span');
  label.className = 'pace-chart__label';
  label.textContent = wedstrijd.label;

  const track = document.createElement('span');
  track.className = 'pace-chart__track';
  const balk = document.createElement('span');
  balk.className = 'pace-chart__bar';
  const waarde = document.createElement('span');
  waarde.className = 'pace-chart__value';
  waarde.textContent = format_tempo(wedstrijd.tempo_sec);
  track.append(balk, waarde);

  rij.append(label, track);
  return rij;
}

/**
 * Bouwt de x-as met recessieve gridlijnen en de doellijn
 * @param {number} doel_tempo_sec
 * @returns {DocumentFragment}
 */
function maak_as (doel_tempo_sec) {
  const fragment = document.createDocumentFragment();
  const grid = document.createElement('div');
  grid.className = 'pace-chart__grid';
  grid.setAttribute('aria-hidden', 'true');
  ticks_sec.forEach((tick) => {
    const lijn = document.createElement('span');
    lijn.style.setProperty('--x', x_positie(tick));
    lijn.dataset.tick = format_tempo(tick);
    grid.append(lijn);
  });

  const doel = document.createElement('div');
  doel.className = 'pace-chart__goal';
  doel.style.setProperty('--x', x_positie(doel_tempo_sec));
  doel.dataset.label = `doel ${format_tempo(Math.floor(doel_tempo_sec))}`;
  doel.setAttribute('aria-hidden', 'true');

  fragment.append(grid, doel);
  return fragment;
}

/**
 * Tooltiptekst voor een wedstrijd, inclusief verschil met het doeltempo
 * @param {Wedstrijd} wedstrijd
 * @param {number} doel_tempo_sec
 * @returns {string}
 */
function get_tooltip_tekst (wedstrijd, doel_tempo_sec) {
  const verschil = wedstrijd.tempo_sec - doel_tempo_sec;
  const vergelijking = verschil > 0
    ? `${format_tempo(verschil)} /km langzamer dan doel`
    : `${format_tempo(-verschil)} /km sneller dan doel`;
  return `${wedstrijd.label} · ${wedstrijd.datum}\n${wedstrijd.eindtijd} · ${format_tempo(wedstrijd.tempo_sec)} /km\n${vergelijking}`;
}

/**
 * Initialiseert de tempo-grafiek
 * @returns {void}
 */
export function init_race_chart () {
  const figuur = document.querySelector('[data-pace-chart]');
  const lijst = document.querySelector('[data-races]');
  if (figuur == null || lijst == null) return;

  const plot = figuur.querySelector('[data-pace-plot]');
  const tooltip = figuur.querySelector('[data-pace-tooltip]');
  const doel_tempo_sec = Number(figuur.dataset.goalSeconds) / Number(figuur.dataset.goalKm);
  const wedstrijden = lees_wedstrijden(lijst);

  plot.append(maak_as(doel_tempo_sec), ...wedstrijden.map(maak_rij));
  plot.querySelectorAll('.pace-chart__row').forEach((rij) => {
    rij.setAttribute('role', 'img');
    rij.setAttribute('aria-label', get_tooltip_tekst(wedstrijden[Number(rij.dataset.index)], doel_tempo_sec));
  });

  const toon_tooltip = (rij) => {
    const wedstrijd = wedstrijden[Number(rij.dataset.index)];
    tooltip.textContent = get_tooltip_tekst(wedstrijd, doel_tempo_sec);
    const figuur_rect = figuur.getBoundingClientRect();
    const balk_rect = rij.querySelector('.pace-chart__bar').getBoundingClientRect();
    tooltip.style.setProperty('--tx', `${Math.min(balk_rect.right - figuur_rect.left, figuur_rect.width - 16)}px`);
    tooltip.style.setProperty('--ty', `${balk_rect.top - figuur_rect.top}px`);
    tooltip.hidden = false;
    plot.querySelectorAll('.pace-chart__row').forEach((andere) => andere.toggleAttribute('data-dim', andere != rij));
  };
  const verberg_tooltip = () => {
    tooltip.hidden = true;
    plot.querySelectorAll('.pace-chart__row').forEach((rij) => rij.removeAttribute('data-dim'));
  };

  plot.querySelectorAll('.pace-chart__row').forEach((rij) => {
    rij.addEventListener('pointerenter', () => toon_tooltip(rij));
    rij.addEventListener('focus', () => toon_tooltip(rij));
    rij.addEventListener('pointerleave', verberg_tooltip);
    rij.addEventListener('blur', verberg_tooltip);
  });
}
