(() => {
  const browser = document.querySelector('[data-publication-browser]');
  if (!browser) return;

  const filters = browser.querySelector('.publication-filters');
  const formatButtons = [...browser.querySelectorAll('[data-filter-format]')];
  const topicButtons = [...browser.querySelectorAll('[data-filter-tag]')];
  const allFormats = browser.querySelector('[data-all-formats]');
  const allTopics = browser.querySelector('[data-all-topics]');
  const awardButton = browser.querySelector('[data-filter-awards]');
  const papers = [...browser.querySelectorAll('[data-paper-tags]')].map(element => ({
    element,
    formats: element.dataset.formats.split(/\s+/),
    hasAward: element.hasAttribute('data-paper-award'),
    tags: new Set(element.dataset.paperTags.split(/\s+/))
  }));
  const sections = [...browser.querySelectorAll('.year-section')];
  const yearLinks = [...browser.querySelectorAll('.year-nav a')];
  const availableFormats = new Set(formatButtons.map(button => button.dataset.filterFormat));
  const formatAliases = new Map(formatButtons.flatMap(button =>
    (button.dataset.formatAliases || '').split(' ').filter(Boolean)
      .map(alias => [alias, button.dataset.filterFormat])
  ));
  const availableTopics = new Set(topicButtons.map(button => button.dataset.filterTag));
  let selectedFormats = new Set();
  let selectedTopics = new Set();
  let awardsOnly = false;

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
    papers.forEach(({ element, formats, tags, hasAward }) => {
      const matchesFormat = !selectedFormats.size || formats.some(format => selectedFormats.has(format));
      const matchesTopics = [...selectedTopics].every(tag => tags.has(tag));
      element.hidden = !matchesFormat || !matchesTopics || (awardsOnly && !hasAward);
    });
    sections.forEach(section => {
      section.hidden = !section.querySelector('.pub-item:not([hidden])');
    });
    yearLinks.forEach(link => {
      link.parentElement.hidden = document.getElementById(link.hash.slice(1)).hidden;
    });
    const hasResults = sections.some(section => !section.hidden);
    browser.querySelector('.year-nav').hidden = !hasResults;
    browser.querySelector('.paper-empty-state').hidden = hasResults;
    formatButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(selectedFormats.has(button.dataset.filterFormat)));
    });
    topicButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(selectedTopics.has(button.dataset.filterTag)));
    });
    allFormats.setAttribute('aria-pressed', String(!selectedFormats.size));
    allTopics.setAttribute('aria-pressed', String(!selectedTopics.size));
    awardButton.setAttribute('aria-pressed', String(awardsOnly));
    updateActiveYear();
  }

  function saveSelection() {
    const url = new URL(window.location.href);
    url.searchParams.delete('format');
    url.searchParams.delete('tag');
    if (awardsOnly) url.searchParams.set('award', '1');
    else url.searchParams.delete('award');
    selectedFormats.forEach(format => url.searchParams.append('format', format));
    selectedTopics.forEach(topic => url.searchParams.append('tag', topic));
    url.hash = '';
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    render();
  }

  function readSelection() {
    const params = new URL(window.location.href).searchParams;
    selectedFormats = new Set(params.getAll('format')
      .map(format => formatAliases.get(format) || format)
      .filter(format => availableFormats.has(format)));
    selectedTopics = new Set(params.getAll('tag').filter(topic => availableTopics.has(topic)));
    awardsOnly = params.get('award') === '1';
    render();
  }

  function toggleSelection(selection, value) {
    if (selection.has(value)) selection.delete(value);
    else selection.add(value);
    saveSelection();
  }

  formatButtons.forEach(button => {
    button.addEventListener('click', () => toggleSelection(selectedFormats, button.dataset.filterFormat));
  });
  topicButtons.forEach(button => {
    button.addEventListener('click', () => toggleSelection(selectedTopics, button.dataset.filterTag));
  });
  allFormats.addEventListener('click', () => {
    selectedFormats.clear();
    saveSelection();
  });
  allTopics.addEventListener('click', () => {
    selectedTopics.clear();
    saveSelection();
  });

  awardButton.addEventListener('click', () => {
    awardsOnly = !awardsOnly;
    saveSelection();
  });

  browser.querySelectorAll('[data-paper-tag], [data-paper-format]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      if (link.dataset.paperFormat) selectedFormats.add(link.dataset.paperFormat);
      else selectedTopics.add(link.dataset.paperTag);
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
