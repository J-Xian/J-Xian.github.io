document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const storedTheme = localStorage.getItem('theme');

    // Apply the stored theme on page load
    if (storedTheme) {
        body.setAttribute('data-theme', storedTheme);
    }

    // Handle the theme toggle click
    themeToggle.addEventListener('click', () => {
        if (body.getAttribute('data-theme') === 'dark') {
            body.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });

    // Add fade-in effect to content on page load
    const heroSection = document.querySelector('.hero');
    const wipBanner = document.querySelector('.wip-banner');
    if (heroSection) {
        heroSection.classList.add('visible');
    }
    if (wipBanner) {
        wipBanner.classList.add('visible');
    }
});
