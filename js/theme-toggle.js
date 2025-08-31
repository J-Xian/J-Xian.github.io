document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.setAttribute('data-theme', savedTheme);
  toggleBtn.innerHTML = savedTheme === 'dark' ? '🌙' : '☀️';
  toggleBtn.title = `Switch to ${savedTheme === 'dark' ? 'light' : 'dark'} mode`;

  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.body.setAttribute('data-theme', newTheme);
    toggleBtn.innerHTML = newTheme === 'dark' ? '🌙' : '☀️';
    toggleBtn.title = `Switch to ${newTheme === 'dark' ? 'light' : 'dark'} mode`;

    localStorage.setItem('theme', newTheme);
  });
});
