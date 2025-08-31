document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('theme-toggle');

  // Load saved theme from localStorage (optional)
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
    toggleBtn.innerHTML = savedTheme === 'dark' ? '🌙' : '☀️';
  } else {
    // Default to dark theme
    document.body.setAttribute('data-theme', 'dark');
    toggleBtn.innerHTML = '🌙';
  }

  toggleBtn.title = 'Switch theme';

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.body.setAttribute('data-theme', newTheme);
    toggleBtn.innerHTML = newTheme === 'dark' ? '🌙' : '☀️';
    toggleBtn.title = `Switch to ${currentTheme} mode`;

    // Save theme preference (optional)
    localStorage.setItem('theme', newTheme);
  });
});
