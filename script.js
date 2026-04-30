/* =========================================================
   VETEVRA — interakce
   ========================================================= */

(() => {
  /* ---- Sticky header on scroll ---- */
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Mobile nav ---- */
  const toggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
  }

  /* ---- Highlight today's hours ---- */
  const hoursTable = document.getElementById('hoursTable');
  if (hoursTable) {
    const today = new Date().getDay(); // 0 = neděle
    const row = hoursTable.querySelector(`.hours-row[data-day="${today}"]`);
    if (row) {
      row.classList.add('today');
      const day = row.querySelector('.hours-day');
      if (day && !day.querySelector('.badge-today')) {
        const badge = document.createElement('span');
        badge.className = 'badge-today';
        badge.textContent = 'DNES';
        day.appendChild(badge);
      }
    }
  }

  /* ---- Reveal on scroll ---- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  /* =========================================================
     RESERVATION FLOW
     ========================================================= */

  const panels = document.querySelectorAll('.booking-panel');
  if (!panels.length) return; // ne-rezervační stránka

  const stepEls = document.querySelectorAll('.stepper .step');
  const state = {
    service: null,
    serviceLabel: null,
    duration: null,
    date: null,
    dateLabel: null,
    time: null
  };

  const goToStep = (n) => {
    panels.forEach(p => p.style.display = (Number(p.dataset.panel) === n) ? '' : 'none');
    stepEls.forEach(s => {
      const sn = Number(s.dataset.step);
      s.classList.remove('active', 'done');
      if (sn === n) s.classList.add('active');
      else if (sn < n) s.classList.add('done');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---- Step 1: Service selection ---- */
  const serviceCards = document.querySelectorAll('.option-card');
  const toStep2 = document.getElementById('toStep2');
  serviceCards.forEach(card => {
    card.addEventListener('click', () => {
      serviceCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.service = card.dataset.service;
      state.serviceLabel = card.dataset.label;
      state.duration = card.dataset.duration;
      toStep2.disabled = false;
      updateSummary();
    });
  });

  toStep2?.addEventListener('click', () => {
    if (!state.service) return;
    renderCalendar();
    goToStep(2);
  });

  /* ---- Back buttons ---- */
  document.querySelectorAll('[data-back-to]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.backTo)));
  });

  /* ---- Step 2: Calendar ---- */

  const monthNames = [
    'Leden','Únor','Březen','Duben','Květen','Červen',
    'Červenec','Srpen','Září','Říjen','Listopad','Prosinec'
  ];
  const dayNamesShort = ['Po','Út','St','Čt','Pá','So','Ne'];

  // Today (the demo treats "today" as 30. dubna 2026 to align with the system date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calendar state
  let viewMonth = today.getMonth(); // 0-based
  let viewYear = today.getFullYear();

  // Closure days (state holiday + dovolená)
  const closures = new Set([
    '2026-05-01',
    '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10'
  ]);

  // Working hours by weekday (1=Po, 2=Út, …, 0=Ne)
  // Operační dny → pouze pro plánované zákroky → pro online rezervaci považujeme za nedostupné
  const workingDays = {
    1: { morning: ['09:00','09:30','10:00','10:30'], afternoon: ['16:00','16:30','17:00','17:30'] },
    2: null, // operační den
    3: { morning: ['09:00','09:30','10:00','10:30'], afternoon: [] },
    4: { morning: [], afternoon: ['16:00','16:30','17:00','17:30'] },
    5: { morning: ['09:00','09:30','10:00','10:30'], afternoon: [] },
    6: null, 0: null
  };

  // Pseudonáhodně "obsazené" sloty (deterministicky z data) — aby UI vypadalo živě
  const isTaken = (dateStr, time) => {
    const seed = (dateStr + time).split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    return (seed % 5) === 0;
  };

  const fmt2 = (n) => String(n).padStart(2, '0');
  const dateKey = (d) => `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`;

  const renderCalendar = () => {
    const grid = document.getElementById('calGrid');
    const monthLabel = document.getElementById('calMonth');
    if (!grid || !monthLabel) return;

    monthLabel.textContent = `${monthNames[viewMonth]} ${viewYear}`;

    // Remove existing day cells (keep day-name headers)
    grid.querySelectorAll('.day, .empty').forEach(n => n.remove());

    const firstDay = new Date(viewYear, viewMonth, 1);
    // Po = 0, Ne = 6 (přepočet z JS Sunday=0)
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // Empty leading cells
    for (let i = 0; i < firstWeekday; i++) {
      const e = document.createElement('div');
      e.className = 'day empty';
      grid.appendChild(e);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'day';
      cell.textContent = d;

      const dateObj = new Date(viewYear, viewMonth, d);
      const wd = dateObj.getDay();
      const key = dateKey(dateObj);

      if (dateObj < today) cell.classList.add('disabled');
      if (closures.has(key)) cell.classList.add('disabled');
      if (!workingDays[wd]) cell.classList.add('disabled');

      if (key === dateKey(today)) cell.classList.add('today');

      if (!cell.classList.contains('disabled')) cell.classList.add('has-slots');

      if (state.date === key) cell.classList.add('selected');

      cell.addEventListener('click', () => {
        if (cell.classList.contains('disabled') || cell.classList.contains('empty')) return;
        grid.querySelectorAll('.day.selected').forEach(s => s.classList.remove('selected'));
        cell.classList.add('selected');
        state.date = key;
        state.dateLabel = `${d}. ${monthNames[viewMonth].toLowerCase()} ${viewYear}`;
        state.time = null;
        document.getElementById('toStep3').disabled = true;
        renderSlots(dateObj);
        updateSummary();
      });

      grid.appendChild(cell);
    }
  };

  const renderSlots = (dateObj) => {
    const wd = dateObj.getDay();
    const cfg = workingDays[wd];
    const title = document.getElementById('slotsTitle');
    const content = document.getElementById('slotsContent');
    if (!cfg) {
      title.textContent = 'Tento den máme zavřeno';
      content.innerHTML = '<p style="color:var(--warm-400); font-size:0.9rem;">Vyberte prosím jiný den.</p>';
      return;
    }

    title.textContent = `Volné časy · ${dateObj.getDate()}. ${monthNames[dateObj.getMonth()].toLowerCase()}`;

    const buildPeriod = (label, icon, slots) => {
      if (!slots.length) return '';
      const buttons = slots.map(t => {
        const taken = isTaken(dateKey(dateObj), t);
        return `<button class="time-slot" data-time="${t}" ${taken ? 'disabled' : ''}>${t}</button>`;
      }).join('');
      return `
        <div class="time-period">
          <h5>${icon} ${label}</h5>
          <div class="time-grid">${buttons}</div>
        </div>
      `;
    };

    const sunIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    const moonIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';

    content.innerHTML =
      buildPeriod('Dopoledne', sunIcon, cfg.morning) +
      buildPeriod('Odpoledne', moonIcon, cfg.afternoon);

    content.querySelectorAll('.time-slot').forEach(b => {
      b.addEventListener('click', () => {
        if (b.disabled) return;
        content.querySelectorAll('.time-slot.selected').forEach(s => s.classList.remove('selected'));
        b.classList.add('selected');
        state.time = b.dataset.time;
        document.getElementById('toStep3').disabled = false;
        updateSummary();
      });
    });
  };

  document.getElementById('calPrev')?.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  document.getElementById('calNext')?.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });

  document.getElementById('toStep3')?.addEventListener('click', () => {
    if (!state.date || !state.time) return;
    goToStep(3);
  });

  /* ---- Step 3: Form & submit ---- */
  document.getElementById('submitBooking')?.addEventListener('click', (e) => {
    e.preventDefault();
    const form = document.getElementById('bookingForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Compose confirmation summary
    const confirmEl = document.getElementById('confirmSummary');
    const owner = document.getElementById('ownerName').value;
    const phone = document.getElementById('ownerPhone').value;
    const pet = document.getElementById('petName').value;
    const species = document.getElementById('petSpecies').value;

    confirmEl.innerHTML = `
      <div class="summary-row"><span class="lab">Služba</span><span class="val">${state.serviceLabel}</span></div>
      <div class="summary-row"><span class="lab">Termín</span><span class="val">${state.dateLabel} v ${state.time}</span></div>
      <div class="summary-row"><span class="lab">Délka</span><span class="val">${state.duration}</span></div>
      <div class="summary-row"><span class="lab">Majitel</span><span class="val">${owner}</span></div>
      <div class="summary-row"><span class="lab">Telefon</span><span class="val">${phone}</span></div>
      <div class="summary-row"><span class="lab">Mazlíček</span><span class="val">${pet} (${species})</span></div>
    `;

    goToStep(4);
  });

  /* ---- Summary updates ---- */
  const updateSummary = () => {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = val ?? '<span class="summary-empty">—</span>';
    };
    set('sumService', state.serviceLabel);
    set('sumDuration', state.duration);
    set('sumDate', state.dateLabel);
    set('sumTime', state.time);
  };

})();
