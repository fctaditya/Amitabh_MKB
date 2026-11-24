// Light / dark theme, remembered between visits (falls back to the OS preference).
const KEY = 'mosquito-theme';

function load() {
  try { const saved = localStorage.getItem(KEY); if (saved) return saved; } catch { /* storage blocked */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function save(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* storage blocked */ }
}

export const theme = {
  dark: false,

  /** onChange(isDark) is called now and after every toggle. */
  init(button, onChange) {
    const apply = name => {
      this.dark = name === 'dark';
      document.documentElement.dataset.theme = name;
      button.textContent = this.dark ? '☀️' : '🌙';
      onChange(this.dark);
    };
    apply(load());
    button.onclick = () => {
      const next = this.dark ? 'light' : 'dark';
      save(next);
      apply(next);
    };
  },
};
