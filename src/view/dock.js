// Control dock under the stage: folded by default, one quiet line with a
// single toggle. Unfolded state is remembered per viewer (localStorage), and
// restored silently on load; only a click scrolls the panels into view.
const KEY = 'ps-dock-open';

function readOpen() {
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function writeOpen(open) {
  try { window.localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* private mode, blocked storage */ }
}

export function initDock(toggle = document.getElementById('dock-toggle')) {
  const body = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
  if (!body) return null;

  function set(open, { reveal = false } = {}) {
    toggle.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    if (open && reveal) {
      // keep the foot of the stage (bars, metrics) in view and bring the panels up under it
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dy = toggle.getBoundingClientRect().top - window.innerHeight * 0.4;
      if (dy > 0) window.scrollBy({ top: dy, behavior: smooth ? 'smooth' : 'auto' });
    }
  }

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    set(open, { reveal: true });
    writeOpen(open);
  });
  // Escape inside the panels folds the dock and returns focus to the toggle
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    set(false);
    writeOpen(false);
    toggle.focus();
  });

  set(readOpen());
  return { set };
}

initDock();
