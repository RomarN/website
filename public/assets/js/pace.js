/**
 * Tempo-calculator voor de marathon: eindtijd → tempo per km en tussentijden.
 */

const marathon_km = 42.195;
const doeltijd_sec = 3 * 3600;

/**
 * Formatteert seconden als h:mm:ss of m:ss
 * @param {number} seconden
 * @param {boolean} met_uren
 * @returns {string}
 */
function format_tijd (seconden, met_uren) {
  const totaal = Math.round(seconden);
  const uren = Math.floor(totaal / 3600);
  const minuten = Math.floor((totaal % 3600) / 60);
  const sec = String(totaal % 60).padStart(2, '0');
  if (met_uren == true) return `${uren}:${String(minuten).padStart(2, '0')}:${sec}`;
  return `${uren * 60 + minuten}:${sec}`;
}

/**
 * Tekst voor de status-badge ten opzichte van de sub-3 doeltijd
 * @param {number} eindtijd_sec
 * @returns {{tekst: string, is_onder_doel: boolean}}
 */
function get_status (eindtijd_sec) {
  if (eindtijd_sec < doeltijd_sec) {
    return { tekst: `${format_tijd(doeltijd_sec - eindtijd_sec, false)} onder doel`, is_onder_doel: true };
  }
  if (eindtijd_sec == doeltijd_sec) return { tekst: 'precies 3 uur', is_onder_doel: false };
  return { tekst: `${format_tijd(eindtijd_sec - doeltijd_sec, false)} boven doel`, is_onder_doel: false };
}

/**
 * Koppelt de slider aan de outputs
 * @returns {void}
 */
export function init_pace_calculator () {
  const root = document.querySelector('[data-pace]');
  if (root == null) return;

  const range = root.querySelector('[data-pace-range]');
  const outputs = {
    finish: root.querySelector('[data-pace-finish]'),
    km: root.querySelector('[data-pace-km]'),
    vijf_km: root.querySelector('[data-pace-5k]'),
    halve: root.querySelector('[data-pace-half]'),
    status: root.querySelector('[data-pace-status]')
  };

  const update = () => {
    const eindtijd = Number(range.value);
    const tempo_per_km = eindtijd / marathon_km;
    const status = get_status(eindtijd);
    const fractie = (eindtijd - Number(range.min)) / (Number(range.max) - Number(range.min));

    outputs.finish.textContent = format_tijd(eindtijd, true);
    outputs.km.textContent = format_tijd(tempo_per_km, false);
    outputs.vijf_km.textContent = format_tijd(tempo_per_km * 5, false);
    outputs.halve.textContent = format_tijd(eindtijd / 2, true);
    outputs.status.textContent = status.tekst;
    root.toggleAttribute('data-over-goal', status.is_onder_doel == false);
    range.style.setProperty('--fill', `${fractie * 100}%`);
    range.setAttribute('aria-valuetext', `${format_tijd(eindtijd, true)}, ${format_tijd(tempo_per_km, false)} per km`);
  };

  range.addEventListener('input', update);
  update();
}
