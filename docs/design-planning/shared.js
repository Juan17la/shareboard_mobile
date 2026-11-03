// Shared chrome for the design-planning pages: navigation bar, theme switch
// and a small line-icon set (Phosphor-like). Write <i data-i="pencil"></i>
// anywhere and it becomes the matching SVG.
(function () {
  const P = {
    cursor: 'M5 3l13 6.5-5.5 2-2 5.5z',
    hand: 'M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v8a7 7 0 01-7 7h-.5a6 6 0 01-4.6-2.2L3.6 15.4a1.6 1.6 0 012.5-2L8 15.5',
    pencil: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
    eraser: 'M9 20h11M4.6 15.4l9-9a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L11 19H8.2zM9 11l5 5',
    rect: 'M4 6h16v12H4z',
    circle: 'M12 4a8 8 0 100 16 8 8 0 000-16z',
    tri: 'M12 4l9 16H3z',
    hex: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z',
    line: 'M5 19L19 5',
    arrow: 'M5 19L19 5M10 5h9v9',
    shapes: 'M7 3l5 8H2zM17 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM13 14h7v7h-7z',
    note: 'M4 4h16v10l-6 6H4zM14 20v-6h6',
    text: 'M5 5h14M12 5v14M9 19h6',
    bucket: 'M4.6 11.4l6-6 7.4 7.4-5.6 5.6a2 2 0 01-2.8 0l-5-5a1.4 1.4 0 010-2zM4 12h14M20.5 15.5s1.5 2 1.5 3a1.5 1.5 0 01-3 0c0-1 1.5-3 1.5-3z',
    share: 'M12 15V3M7 8l5-5 5 5M5 13v7h14v-7',
    dots: 'M6 12h.01M12 12h.01M18 12h.01',
    minus: 'M5 12h14', plus: 'M12 5v14M5 12h14',
    undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11',
    redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13',
    smile: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8.5 14a4 4 0 007 0M9 9.5h.01M15 9.5h.01',
    timer: 'M12 5a8 8 0 100 16 8 8 0 000-16zM12 13V9M10 2h4',
    close: 'M6 6l12 12M18 6L6 18',
    chev: 'M9 6l6 6-6 6',
    back: 'M15 6l-6 6 6 6',
    link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
    lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 017 0V11',
    copy: 'M9 9h11v11H9zM15 9V4H4v11h5',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
    image: 'M3 5h18v14H3zM8.5 8.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM21 16l-5-5L5 19',
    tpl: 'M4 4h16v16H4zM4 10h16M10 10v10',
    sparkle: 'M12 3l2 5.5L19.5 10.5 14 12.5 12 18l-2-5.5-5.5-2L10 8.5zM19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
    gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M4.9 4.9L7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
    keyboard: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
    laptop: 'M4 5h16v11H4zM2 19h20',
    users: 'M9 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM2 20a7 7 0 0114 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 014 6',
    user: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 21a8 8 0 0116 0',
    check: 'M5 12l5 5 9-10',
    backspace: 'M8 5h13v14H8l-6-7zM12 9l5 6M17 9l-5 6',
    globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    chat: 'M4 20l1.4-4A8 8 0 1112 20a8 8 0 01-3.8-1z',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
    signin: 'M14 4h5v16h-5M10 8l4 4-4 4M14 12H3',
    grid: 'M6 6h.01M12 6h.01M18 6h.01M6 12h.01M12 12h.01M18 12h.01M6 18h.01M12 18h.01M18 18h.01',
    fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  };
  const svg = (name) =>
    `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"${name === 'dots' || name === 'grid' ? ' style="stroke-width:3"' : ''}><path d="${P[name] || ''}"/></svg>`;
  document.querySelectorAll('i[data-i]').forEach((el) => {
    el.outerHTML = svg(el.dataset.i);
  });

  const pages = [
    ['mockups.html', 'Mockups'],
    ['design-system.html', 'Design system'],
    ['navigation-flow.html', 'Navigation flow'],
    ['product-vision.html', 'Product vision'],
  ];
  const here = location.pathname.split('/').pop() || 'mockups.html';
  const bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML =
    `<a class="brand" href="mockups.html"><span class="ring"></span>Shareboard · Design planning</a>` +
    `<nav aria-label="Design planning pages">${pages
      .map(([href, label]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ''}>${label}</a>`)
      .join('')}</nav>` +
    `<button class="theme-btn" type="button" aria-label="Switch light or dark theme">Light / Dark</button>`;
  document.body.prepend(bar);

  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('sb-plan-theme');
    if (saved) root.dataset.theme = saved;
  } catch (e) {}
  bar.querySelector('.theme-btn').addEventListener('click', () => {
    const dark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('sb-plan-theme', root.dataset.theme); } catch (e) {}
  });
})();
