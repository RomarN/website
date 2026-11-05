/**
 * Command palette (Ctrl/⌘ + K): navigeren, acties en links via het toetsenbord.
 */

/**
 * @typedef {Object} Commando
 * @property {string} groep
 * @property {string} label
 * @property {string} icoon
 * @property {string} [hint]
 * @property {string} [trefwoorden]
 * @property {() => void} actie
 */

/**
 * Scrollt soepel naar een sectie
 * @param {string} selector
 * @returns {() => void}
 */
function ga_naar (selector) {
  return () => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Opent een externe link in een nieuw tabblad
 * @param {string} url
 * @returns {() => void}
 */
function open_link (url) {
  return () => window.open(url, '_blank', 'noopener');
}

/**
 * Bouwt de lijst met commando's
 * @param {{toggle_theme: Function, copy_email: Function, show_toast: Function}} acties
 * @returns {Commando[]}
 */
function get_commandos (acties) {
  return [
    { groep: 'Navigeer', label: 'Home', icoon: '~', hint: 'g h', actie: ga_naar('#top') },
    { groep: 'Navigeer', label: 'Over mij', icoon: '01', trefwoorden: 'about tue jads', actie: ga_naar('#over') },
    { groep: 'Navigeer', label: 'Wat ik bouw', icoon: '02', trefwoorden: 'werk republiq pien willm', actie: ga_naar('#werk') },
    { groep: 'Navigeer', label: 'Stack & skills', icoon: '03', trefwoorden: 'django react python aws', actie: ga_naar('#stack') },
    { groep: 'Navigeer', label: 'Opleiding & certificaten', icoon: '04', trefwoorden: 'cv studie', actie: ga_naar('#cv') },
    { groep: 'Navigeer', label: 'Buiten werk', icoon: '05', trefwoorden: 'hobby fiets triatlon gitaar', actie: ga_naar('#buiten-werk') },
    { groep: 'Navigeer', label: 'Nu bezig met', icoon: '06', trefwoorden: 'marathon rotterdam hardlopen tempo', actie: ga_naar('#nu') },
    { groep: 'Navigeer', label: 'Wedstrijden', icoon: '07', trefwoorden: 'marathon eindhoven amsterdam hoogland halve tijden pr', actie: ga_naar('#wedstrijden') },
    { groep: 'Navigeer', label: 'Contact', icoon: '@', actie: ga_naar('#contact') },
    { groep: 'Acties', label: 'Wissel thema', icoon: '◐', hint: 'T', trefwoorden: 'dark light donker licht', actie: () => acties.toggle_theme() },
    { groep: 'Acties', label: 'Kopieer e-mailadres', icoon: '⧉', trefwoorden: 'mail', actie: () => acties.copy_email() },
    { groep: 'Acties', label: 'Stuur een e-mail', icoon: '✉', actie: () => { location.href = 'mailto:romarjamal@gmail.com'; } },
    {
      groep: 'Acties', label: 'Deel deze pagina', icoon: '↗', trefwoorden: 'link url share',
      actie: async () => {
        if (navigator.share != null) {
          await navigator.share({ title: document.title, url: location.origin }).catch(() => {});
          return;
        }
        await navigator.clipboard.writeText(location.origin);
        acties.show_toast('Link gekopieerd');
      }
    },
    { groep: 'Links', label: 'LinkedIn', icoon: 'in', actie: open_link('https://www.linkedin.com/in/romar-nathoe/') },
    { groep: 'Links', label: 'GitHub', icoon: 'gh', actie: open_link('https://github.com/RomarN') },
    { groep: 'Links', label: 'Republiq', icoon: 'R', actie: open_link('https://www.republiq.nl') },
    { groep: 'Links', label: 'AWS-certificaat', icoon: 'aws', actie: open_link('/Bestanden/AWSCertifiedCloudPractitionercertificate.pdf') }
  ];
}

/**
 * Fuzzy match: alle tekens van de zoekterm in volgorde aanwezig. Hogere score = betere match.
 * @param {string} zoekterm
 * @param {string} tekst
 * @returns {number} -1 bij geen match
 */
function fuzzy_score (zoekterm, tekst) {
  if (zoekterm.length == 0) return 0;
  const doel = tekst.toLowerCase();
  if (doel.includes(zoekterm)) return 100 - doel.indexOf(zoekterm);
  let positie = -1;
  let score = 0;
  for (const char of zoekterm) {
    const volgende = doel.indexOf(char, positie + 1);
    if (volgende == -1) return -1;
    score += volgende == positie + 1 ? 3 : 1;
    positie = volgende;
  }
  return score;
}

/**
 * Checkt of de gebruiker in een invoerveld aan het typen is
 * @param {EventTarget} target
 * @returns {boolean}
 */
function is_typing (target) {
  return target instanceof HTMLElement && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName));
}

/**
 * Initialiseert de command palette en globale sneltoetsen
 * @param {{toggle_theme: Function, copy_email: Function, show_toast: Function}} acties
 * @returns {void}
 */
export function init_palette (acties) {
  const dialog = document.querySelector('[data-palette]');
  const input = document.querySelector('[data-palette-input]');
  const lijst = document.querySelector('[data-palette-list]');
  const commandos = get_commandos(acties);
  let resultaten = commandos;
  let actief_index = 0;

  const render = () => {
    lijst.replaceChildren();
    if (resultaten.length == 0) {
      const leeg = document.createElement('li');
      leeg.className = 'palette__empty';
      leeg.textContent = 'Niets gevonden. Probeer "thema" of "contact".';
      lijst.append(leeg);
      return;
    }

    let vorige_groep = '';
    resultaten.forEach((commando, index) => {
      if (commando.groep != vorige_groep) {
        const kop = document.createElement('li');
        kop.className = 'palette__group';
        kop.setAttribute('role', 'presentation');
        kop.textContent = commando.groep;
        lijst.append(kop);
        vorige_groep = commando.groep;
      }
      const item = document.createElement('li');
      item.className = 'palette__item';
      item.id = `palette-item-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index == actief_index));
      item.dataset.index = index;

      const icoon = document.createElement('span');
      icoon.className = 'palette__icon';
      icoon.textContent = commando.icoon;
      const label = document.createElement('span');
      label.textContent = commando.label;
      item.append(icoon, label);

      if (commando.hint != null) {
        const hint = document.createElement('span');
        hint.className = 'palette__hint';
        hint.textContent = commando.hint;
        item.append(hint);
      }
      lijst.append(item);
    });
    input.setAttribute('aria-activedescendant', `palette-item-${actief_index}`);
  };

  const zet_actief = (index) => {
    if (resultaten.length == 0) return;
    actief_index = (index + resultaten.length) % resultaten.length;
    lijst.querySelectorAll('.palette__item').forEach((item) => {
      item.setAttribute('aria-selected', String(Number(item.dataset.index) == actief_index));
    });
    input.setAttribute('aria-activedescendant', `palette-item-${actief_index}`);
    lijst.querySelector(`[data-index="${actief_index}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const filter = () => {
    const zoekterm = input.value.trim().toLowerCase();
    resultaten = commandos
      .map((commando) => ({
        commando,
        score: fuzzy_score(zoekterm, `${commando.label} ${commando.trefwoorden ?? ''} ${commando.groep}`)
      }))
      .filter((match) => match.score >= 0)
      .sort((a, b) => (zoekterm.length > 0 ? b.score - a.score : 0))
      .map((match) => match.commando);
    actief_index = 0;
    render();
  };

  const open = () => {
    if (dialog.open == true) return;
    input.value = '';
    filter();
    dialog.showModal();
    input.focus();
  };

  const sluit = () => dialog.close();

  const voer_uit = (index) => {
    const commando = resultaten[index];
    if (commando == null) return;
    sluit();
    commando.actie();
  };

  input.addEventListener('input', filter);
  input.addEventListener('keydown', (event) => {
    if (event.key == 'ArrowDown') { event.preventDefault(); zet_actief(actief_index + 1); }
    if (event.key == 'ArrowUp') { event.preventDefault(); zet_actief(actief_index - 1); }
    if (event.key == 'Enter') { event.preventDefault(); voer_uit(actief_index); }
  });

  lijst.addEventListener('pointermove', (event) => {
    const item = event.target.closest('.palette__item');
    if (item != null && Number(item.dataset.index) != actief_index) zet_actief(Number(item.dataset.index));
  });
  lijst.addEventListener('click', (event) => {
    const item = event.target.closest('.palette__item');
    if (item != null) voer_uit(Number(item.dataset.index));
  });

  // Klik op backdrop sluit
  dialog.addEventListener('click', (event) => { if (event.target == dialog) sluit(); });

  document.querySelectorAll('[data-open-palette]').forEach((button) => button.addEventListener('click', open));

  let laatste_g = 0;
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() == 'k') {
      event.preventDefault();
      if (dialog.open == true) sluit(); else open();
      return;
    }
    if (dialog.open == true || is_typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key == '/') { event.preventDefault(); open(); }
    if (event.key.toLowerCase() == 't') acties.toggle_theme();
    // Vim-achtig: g h = naar boven
    if (event.key == 'g') laatste_g = performance.now();
    if (event.key == 'h' && performance.now() - laatste_g < 600) ga_naar('#top')();
  });
}
