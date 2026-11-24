(() => {
  let theme;
  try {
    theme = localStorage.getItem('theme');
  } catch {
    // The portal follows the system preference when storage is unavailable.
  }
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  }
})();
