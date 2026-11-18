// Boot and wiring. Filled in by later tasks (model, audio, views).
import { createBus } from './bus.js';

export const bus = createBus();

const root = document.documentElement;
document.getElementById('theme').addEventListener('click', () => {
  const dark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
});
