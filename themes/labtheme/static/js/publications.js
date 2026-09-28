(() => {
  const browser = document.querySelector('[data-publication-browser]');
  if (!browser) return;

  const filters = browser.querySelector('.publication-filters');
  const buttons = [...browser.querySelectorAll('[data-filter-tag]')];
  const allButton = browser.querySelector('[data-all-papers]');
  const papers = [...browser.querySelectorAll('[data-paper-tags]')].map(element => ({
    element,
    tags: new Set(element.dataset.paperTags.split(/\s+/))
  }));
  const sections = [...browser.querySelectorAll('.year-section')];
  const yearLinks = [...browser.querySelectorAll('.year-nav a')];
  const availableTags = new Set(buttons.map(button => button.dataset.filterTag));
  let selected = new Set();

  const headerHeight = () => document.querySelector('header')?.offsetHeight || 0;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function updateActiveYear() {
    const visibleSections = sections.filter(section => !section.hidden);
    let current = visibleSections[0]?.id;
    visibleSections.forEach(section => {
      if (section.getBoundingClientRect().top <= headerHeight() + 32) current = section.id;
    });
    yearLinks.forEach(link => {
      const active = link.hash === '#' + current;
      link.parentElement.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function render() {
    let count = 0;
    papers.forEach(({ element, tags }) => {
      element.hidden = ![...selected].every(tag => tags.has(tag));
      if (!element.hidden) count++;
    });
    sections.forEach(section => {
      section.hidden = !section.querySelector('.pub-item:not([hidden])');
    });
    yearLinks.forEach(link => {
      link.parentElement.hidden = document.getElementById(link.hash.slice(1)).hidden;
    });
    browser.querySelector('.year-nav').hidden = count === 0;
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(selected.has(button.dataset.filterTag)));
    });
    allButton.setAttribute('aria-pressed', String(selected.size === 0));
    browser.querySelector('.paper-results-count').textContent = selected.size
      ? `${count} of ${papers.length} papers`
      : `${papers.length} papers`;
    browser.querySelector('.paper-empty-state').hidden = count !== 0;
    updateActiveYear();
  }

  function saveSelection() {
    const url = new URL(window.location.href);
    url.searchParams.delete('tag');
    selected.forEach(tag => url.searchParams.append('tag', tag));
    url.hash = '';
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    render();
  }

  function readSelection() {
    selected = new Set(new URL(window.location.href).searchParams.getAll('tag')
      .filter(tag => availableTags.has(tag)));
    render();
  }

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const tag = button.dataset.filterTag;
      if (selected.has(tag)) selected.delete(tag);
      else selected.add(tag);
      saveSelection();
    });
  });
  allButton.addEventListener('click', () => {
    selected.clear();
    saveSelection();
  });

  browser.querySelectorAll('[data-paper-tag]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      selected.add(link.dataset.paperTag);
      saveSelection();
      window.scrollTo({
        top: filters.getBoundingClientRect().top + window.scrollY - headerHeight() - 16,
        behavior: reducedMotion() ? 'auto' : 'smooth'
      });
    });
  });

  yearLinks.forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      const target = document.getElementById(link.hash.slice(1));
      if (!target || target.hidden) return;
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - headerHeight() - 16,
        behavior: reducedMotion() ? 'auto' : 'smooth'
      });
    });
  });

  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      updateActiveYear();
      scheduled = false;
    });
  }, { passive: true });
  window.addEventListener('resize', updateActiveYear);
  window.addEventListener('popstate', readSelection);
  filters.hidden = false;
  readSelection();
})();
