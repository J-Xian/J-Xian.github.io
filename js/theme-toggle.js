document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'theme-toggle';
  toggleBtn.innerHTML = '🌙';
toggleBtn.title = 'Switch theme';

toggleBtn.addEventListener('click', () => {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', newTheme);
  toggleBtn.innerHTML = newTheme === 'dark' ? '🌙' : '☀️';
});
});
