document.addEventListener('DOMContentLoaded', () => {
    const fadeInElements = document.querySelectorAll('.fade-in');
    const wipBanner = document.querySelector('.wip-banner');

    const observerOptions = {
        root: null, // relative to the viewport
        rootMargin: '0px',
        threshold: 0.1 // a small threshold to trigger early
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    fadeInElements.forEach(el => {
        observer.observe(el);
    });

    // Special handling for the WIP banner to make it slide in with a delay
    if (wipBanner) {
      setTimeout(() => {
        wipBanner.classList.add('visible');
      }, 500); // 500ms delay before the banner slides in
    }
});
