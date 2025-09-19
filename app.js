const STORAGE_KEY = 'glowos_state_v2';
const WALLPAPERS = [
  { id: 'aurora', name: 'Aurora', value: 'linear-gradient(140deg, #301860, #6638f0 55%, #ff7eb3)' },
  { id: 'sunset', name: 'Sunset', value: 'linear-gradient(150deg, #ff9a9e 0%, #fad0c4 100%)' },
  { id: 'ocean', name: 'Ocean', value: 'linear-gradient(145deg, #13547a 0%, #80d0c7 100%)' },
  { id: 'forest', name: 'Forest', value: 'linear-gradient(160deg, #184e68 0%, #57ca85 100%)' },
  { id: 'candy', name: 'Candy', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' }
];

const DEFAULT_ICONS = [
  { id: 'notes-icon', app: 'notes', label: 'Notes', glyph: '📝' },
  { id: 'tasks-icon', app: 'tasks', label: 'Tasks', glyph: '✅' },
  { id: 'files-icon', app: 'files', label: 'Files', glyph: '🗂️' },
  { id: 'terminal-icon', app: 'terminal', label: 'Terminal', glyph: '⌨️' },
  { id: 'browser-icon', app: 'browser', label: 'Browser', glyph: '🌐' },
  { id: 'settings-icon', app: 'settings', label: 'Settings', glyph: '⚙️' }
];

const DEFAULT_STATE = {
  settings: {
    theme: 'light',
    wallpaper: WALLPAPERS[0].id,
    sound: true
  },
  desktop: {
    icons: DEFAULT_ICONS.map((icon, index) => ({
      ...icon,
      position: { x: 24 + (index % 4) * 110, y: 24 + Math.floor(index / 4) * 110 }
    })),
    customWallpaper: ''
  },
  windows: {},
  notes: {
    notes: [
      {
        id: makeId(),
        title: 'Welcome note',
        content:
          '# Hello!\n\nGlowOS remembers what you do. Try **Cmd/Ctrl+K** for the quick launcher.\n\nKeep your thoughts here and preview Markdown live.',
        updatedAt: Date.now()
      }
    ],
    activeId: null,
    search: ''
  },
  tasks: {
    items: [
      { id: makeId(), title: 'Explore Settings', due: null, status: 'inbox' },
      { id: makeId(), title: 'Pin your favourite wallpaper', due: null, status: 'today' }
    ]
  },
  files: {
    tree: {
      type: 'folder',
      name: 'Home',
      children: [
        {
          type: 'folder',
          name: 'Memories',
          children: [
            { type: 'file', name: 'manifesto.txt', content: 'Keep things whimsical. Protect the vibe.' }
          ]
        },
        { type: 'file', name: 'readme.md', content: 'GlowOS is your tiny desk companion. ✨' }
      ]
    },
    currentPath: ['Home']
  },
  terminal: {
    log: ['GlowOS terminal ready. Type `help` to discover commands.'],
    history: [],
    pointer: null
  },
  browser: {
    history: ['about:home'],
    index: 0
  }
};

const apps = {};
const windows = new Map();
let zIndexCounter = 10;
let launcherSelection = 0;

const elements = {
  root: document.querySelector('.os'),
  desktop: document.getElementById('desktop'),
  wallpaper: document.getElementById('wallpaper'),
  desktopIcons: document.getElementById('desktop-icons'),
  windowLayer: document.getElementById('desktop-windows'),
  dock: document.getElementById('dock'),
  topBarLabel: document.getElementById('active-app-label'),
  clock: document.getElementById('menu-clock'),
  launcher: document.getElementById('launcher'),
  launcherInput: document.getElementById('launcher-input'),
  launcherResults: document.getElementById('launcher-results'),
  desktopMenu: document.getElementById('desktop-menu')
};

let state = loadState();
ensureDefaultIcons();

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return mergeState(parsed, DEFAULT_STATE);
  } catch (error) {
    console.warn('Unable to load GlowOS state, resetting.', error);
    return clone(DEFAULT_STATE);
  }
}

function mergeState(saved, fallback) {
  if (Array.isArray(fallback)) {
    return Array.isArray(saved) ? saved : clone(fallback);
  }
  if (typeof fallback === 'object' && fallback !== null) {
    const merged = { ...fallback };
    for (const key of Object.keys(fallback)) {
      merged[key] = mergeState(saved?.[key], fallback[key]);
    }
    for (const key of Object.keys(saved || {})) {
      if (!(key in merged)) {
        merged[key] = saved[key];
      }
    }
    return merged;
  }
  return saved ?? fallback;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const soundEngine = (() => {
  let ctx;
  function play(freq = 520, duration = 0.08) {
    if (!state.settings.sound) return;
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }
  return { play };
})();

function init() {
  applyTheme();
  applyWallpaper();
  renderClock();
  renderDesktopIcons();
  renderDock();
  setupLauncher();
  setupDesktopMenu();
  restoreWindows();
  setupTopBarMenus();
  setupGlobalShortcuts();
  elements.desktop.addEventListener('contextmenu', openDesktopMenu);
  elements.desktopIcons.addEventListener('contextmenu', openDesktopMenu);
  elements.windowLayer.addEventListener('contextmenu', openDesktopMenu);
  elements.dock.addEventListener('contextmenu', openDesktopMenu);
  document.addEventListener('click', () => hideDesktopMenu());
}

function applyTheme() {
  elements.root.dataset.theme = state.settings.theme;
}

function applyWallpaper() {
  const wallpaper =
    state.desktop.customWallpaper || WALLPAPERS.find((wall) => wall.id === state.settings.wallpaper)?.value;
  if (wallpaper) {
    elements.wallpaper.style.background = wallpaper;
  }
}

function renderClock() {
  function tick() {
    const now = new Date();
    elements.clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 30_000);
}

function renderDesktopIcons() {
  elements.desktopIcons.innerHTML = '';
  state.desktop.icons.forEach((icon) => {
    const el = document.createElement('button');
    el.className = 'desktop-icon';
    el.dataset.iconId = icon.id;
    const posX = icon.position?.x ?? 24;
    const posY = icon.position?.y ?? 24;
    if (!icon.position) {
      icon.position = { x: posX, y: posY };
    }
    el.style.left = posX + 'px';
    el.style.top = posY + 'px';
    el.innerHTML = `
      <span class="desktop-icon__glyph">${icon.glyph}</span>
      <span class="desktop-icon__label">${icon.label}</span>
    `;
    el.addEventListener('dblclick', () => openApp(icon.app));
    makeIconDraggable(el, icon);
    elements.desktopIcons.appendChild(el);
  });
}

function ensureDefaultIcons() {
  const existing = new Set(state.desktop.icons.map((icon) => icon.app));
  DEFAULT_ICONS.forEach((definition, index) => {
    if (!existing.has(definition.app)) {
      state.desktop.icons.push({
        ...definition,
        position: { x: 24 + (index % 4) * 110, y: 24 + Math.floor(index / 4) * 110 }
      });
    }
  });
  saveState();
}

function renderDock() {
  elements.dock.innerHTML = '';
  DEFAULT_ICONS.forEach((icon) => {
    const template = document.getElementById('dock-item-template');
    const btn = template.content.firstElementChild.cloneNode(true);
    btn.textContent = icon.glyph;
    btn.title = icon.label;
    btn.addEventListener('click', () => openApp(icon.app));
    elements.dock.appendChild(btn);
  });
}

function makeIconDraggable(el, icon) {
  let startX;
  let startY;
  let originX;
  let originY;
  function onPointerDown(event) {
    event.preventDefault();
    el.classList.add('desktop-icon--dragging');
    startX = event.clientX;
    startY = event.clientY;
    originX = icon.position.x;
    originY = icon.position.y;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }
  function onPointerMove(event) {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const x = Math.max(12, originX + dx);
    const y = Math.max(12, originY + dy);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
  function onPointerUp(event) {
    window.removeEventListener('pointermove', onPointerMove);
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    icon.position.x = Math.max(12, originX + dx);
    icon.position.y = Math.max(12, originY + dy);
    el.classList.remove('desktop-icon--dragging');
    saveState();
  }
  el.addEventListener('pointerdown', onPointerDown);
}

function setupTopBarMenus() {
  const menuData = {
    file: [
      { label: 'New Note', action: () => openApp('notes', { focusPane: 'editor', create: true }) },
      { label: 'New Task', action: () => openApp('tasks', { newTask: true }) },
      { label: 'Settings', action: () => openApp('settings') }
    ],
    edit: [
      { label: 'Undo', action: () => soundEngine.play(340) },
      { label: 'Redo', action: () => soundEngine.play(420) },
      { divider: true },
      { label: 'Cut', action: () => document.execCommand('cut') },
      { label: 'Copy', action: () => document.execCommand('copy') },
      { label: 'Paste', action: () => document.execCommand('paste') }
    ],
    view: [
      { label: 'Light Theme', action: () => setTheme('light') },
      { label: 'Dark Theme', action: () => setTheme('dark') },
      { label: 'Toggle Sound', action: () => toggleSound() }
    ],
    go: [
      { label: 'Home', action: () => openApp('files', { path: ['Home'] }) },
      { label: 'Notes', action: () => openApp('notes') },
      { label: 'Tasks', action: () => openApp('tasks') }
    ],
    help: [
      { label: 'GlowOS Help', action: () => openApp('browser', { url: 'https://github.com' }) },
      { label: 'About GlowOS', action: () => openAboutDialog() }
    ]
  };

  document.querySelectorAll('.menu-trigger').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = menuData[btn.dataset.menu];
      if (!menu) return;
      const existing = document.querySelector('.dropdown');
      if (existing) existing.remove();
      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown';
      const rect = btn.getBoundingClientRect();
      const osRect = elements.root.getBoundingClientRect();
      dropdown.style.top = rect.bottom - osRect.top + 6 + 'px';
      dropdown.style.left = rect.left - osRect.left + 'px';
      const list = document.createElement('ul');
      menu.forEach((item) => {
        if (item.divider) {
          const divider = document.createElement('div');
          divider.className = 'dropdown__divider';
          list.appendChild(divider);
          return;
        }
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.textContent = item.label;
        button.className = 'context-menu__item';
        button.addEventListener('click', () => {
          item.action();
          dropdown.remove();
        });
        li.appendChild(button);
        list.appendChild(li);
      });
      dropdown.appendChild(list);
      elements.root.appendChild(dropdown);
      const onClick = (e) => {
        if (!dropdown.contains(e.target)) {
          dropdown.remove();
          document.removeEventListener('click', onClick);
        }
      };
      setTimeout(() => document.addEventListener('click', onClick), 0);
    });
  });
}

function setTheme(theme) {
  state.settings.theme = theme;
  applyTheme();
  saveState();
}

function toggleSound() {
  state.settings.sound = !state.settings.sound;
  saveState();
}

function openAboutDialog() {
  const dialog = document.createElement('div');
  dialog.style.position = 'fixed';
  dialog.style.inset = '0';
  dialog.style.display = 'grid';
  dialog.style.placeItems = 'center';
  dialog.style.background = 'rgba(12, 19, 38, 0.6)';
  dialog.style.backdropFilter = 'blur(18px)';
  dialog.style.zIndex = 400;
  const panel = document.createElement('div');
  panel.style.width = '320px';
  panel.style.background = 'rgba(255, 255, 255, 0.95)';
  panel.style.borderRadius = '18px';
  panel.style.padding = '24px';
  panel.innerHTML = `
    <h2>GlowOS</h2>
    <p>A tiny personal desktop made for the browser.</p>
    <button type="button">Close</button>
  `;
  const closeBtn = panel.querySelector('button');
  closeBtn.addEventListener('click', () => dialog.remove());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.remove();
  });
  dialog.appendChild(panel);
  document.body.appendChild(dialog);
}

function setupGlobalShortcuts() {
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      toggleLauncher(true);
    }
    if (event.key === 'Escape') {
      if (!elements.launcher.hidden) {
        toggleLauncher(false);
      }
    }
  });
}

function setupLauncher() {
  elements.launcher.addEventListener('click', (event) => {
    if (event.target === elements.launcher) {
      toggleLauncher(false);
    }
  });
  elements.launcherInput.addEventListener('input', renderLauncherResults);
  elements.launcherInput.addEventListener('keydown', (event) => {
    const results = Array.from(elements.launcherResults.children);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length > 0) {
        launcherSelection = Math.min(results.length - 1, launcherSelection + 1);
        updateLauncherSelection(results);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0) {
        launcherSelection = Math.max(0, launcherSelection - 1);
        updateLauncherSelection(results);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[launcherSelection];
      if (selected) {
        const action = selected.dataset.action;
        runLauncherAction(action);
      }
    }
  });
}

function toggleLauncher(open) {
  if (open) {
    elements.launcher.hidden = false;
    elements.launcherInput.value = '';
    renderLauncherResults();
    launcherSelection = 0;
    elements.launcherInput.focus();
  } else {
    elements.launcher.hidden = true;
    elements.launcherInput.value = '';
  }
}

function renderLauncherResults() {
  const query = elements.launcherInput.value.trim().toLowerCase();
  const entries = [
    ...DEFAULT_ICONS.map((icon) => ({
      id: icon.app,
      label: icon.label,
      glyph: icon.glyph,
      action: `open:${icon.app}`
    })),
    { id: 'theme-light', label: 'Switch to Light Theme', glyph: '🌞', action: 'theme:light' },
    { id: 'theme-dark', label: 'Switch to Dark Theme', glyph: '🌙', action: 'theme:dark' },
    { id: 'toggle-sound', label: state.settings.sound ? 'Disable Sound' : 'Enable Sound', glyph: '🔈', action: 'sound:toggle' }
  ];
  const filtered = entries.filter((entry) =>
    entry.label.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query)
  );
  elements.launcherResults.innerHTML = '';
  if (filtered.length === 0) {
    launcherSelection = 0;
  } else {
    launcherSelection = Math.min(launcherSelection, filtered.length - 1);
  }
  filtered.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'launcher__result';
    item.dataset.action = entry.action;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', index === launcherSelection ? 'true' : 'false');
    item.innerHTML = `<span>${entry.glyph}</span><span>${entry.label}</span>`;
    item.addEventListener('mouseenter', () => {
      launcherSelection = index;
      updateLauncherSelection(Array.from(elements.launcherResults.children));
    });
    item.addEventListener('click', () => runLauncherAction(entry.action));
    elements.launcherResults.appendChild(item);
  });
}

function updateLauncherSelection(results) {
  results.forEach((el, idx) => {
    el.setAttribute('aria-selected', idx === launcherSelection ? 'true' : 'false');
  });
}

function runLauncherAction(action) {
  if (!action) return;
  const [type, value] = action.split(':');
  if (type === 'open') {
    openApp(value);
  } else if (type === 'theme') {
    setTheme(value);
  } else if (type === 'sound') {
    toggleSound();
  }
  toggleLauncher(false);
}

function setupDesktopMenu() {
  elements.desktopMenu.innerHTML = '';
  const items = [
    { label: 'New Note', action: () => openApp('notes', { create: true }) },
    { label: 'New Task', action: () => openApp('tasks', { newTask: true }) },
    { label: 'Change Wallpaper…', action: () => openApp('settings') },
    { label: 'Toggle Theme', action: () => setTheme(state.settings.theme === 'light' ? 'dark' : 'light') }
  ];
  items.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'context-menu__item';
    button.type = 'button';
    button.textContent = item.label;
    button.addEventListener('click', () => {
      item.action();
      hideDesktopMenu();
    });
    elements.desktopMenu.appendChild(button);
  });
}

function openDesktopMenu(event) {
  if (event.target.closest('.window')) {
    hideDesktopMenu();
    return;
  }
  event.preventDefault();
  hideDesktopMenu();
  elements.desktopMenu.style.left = event.clientX + 'px';
  elements.desktopMenu.style.top = event.clientY + 'px';
  elements.desktopMenu.setAttribute('open', '');
}

function hideDesktopMenu() {
  elements.desktopMenu.removeAttribute('open');
}

function openApp(appId, options = {}) {
  const definition = apps[appId];
  if (!definition) return;
  let windowInfo = state.windows[appId];
  let win;
  if (windowInfo && windows.has(appId)) {
    win = windows.get(appId);
    delete win.element.dataset.hidden;
    focusWindow(win.element);
  } else {
    win = createWindow(appId, definition, windowInfo);
  }
  definition.open?.(win, options);
  soundEngine.play(560);
}

function createWindow(appId, definition, persisted) {
  const template = document.getElementById('window-template');
  const fragment = template.content.cloneNode(true);
  const windowEl = fragment.querySelector('.window');
  windowEl.dataset.app = appId;
  windowEl.querySelector('.window__title').textContent = definition.name;
  const bodyEl = windowEl.querySelector('.window__body');
  if (definition.render) {
    definition.render(bodyEl, windowEl);
  }
  elements.windowLayer.appendChild(windowEl);
  windowEl.style.zIndex = zIndexCounter++;
  windowEl.style.left = persisted?.position?.x + 'px' || 120 + Math.random() * 40 + 'px';
  windowEl.style.top = persisted?.position?.y + 'px' || 120 + Math.random() * 40 + 'px';
  windowEl.style.width = (persisted?.size?.width || definition.width || 560) + 'px';
  windowEl.style.height = (persisted?.size?.height || definition.height || 420) + 'px';

  const closeBtn = windowEl.querySelector('.window__close');
  const minimizeBtn = windowEl.querySelector('.window__minimize');
  const floatBtn = windowEl.querySelector('.window__float');
  closeBtn.addEventListener('click', () => closeWindow(windowEl));
  minimizeBtn.addEventListener('click', () => minimizeWindow(windowEl));
  floatBtn.addEventListener('click', () => toggleFloat(windowEl));
  windowEl.addEventListener('pointerdown', () => focusWindow(windowEl));
  makeWindowDraggable(windowEl);
  makeWindowResizable(windowEl);

  windows.set(appId, { element: windowEl, definition });
  state.windows[appId] = state.windows[appId] || {};
  saveWindowState(windowEl);
  focusWindow(windowEl);
  saveState();
  return windows.get(appId);
}

function focusWindow(windowEl) {
  const current = elements.windowLayer.querySelector('.window[data-focused="true"]');
  if (current && current !== windowEl) current.dataset.focused = 'false';
  windowEl.dataset.focused = 'true';
  windowEl.style.zIndex = zIndexCounter++;
  const appId = windowEl.dataset.app;
  const definition = apps[appId];
  if (definition) {
    elements.topBarLabel.textContent = definition.name;
  }
}

function closeWindow(windowEl) {
  const appId = windowEl.dataset.app;
  windowEl.remove();
  windows.delete(appId);
  delete state.windows[appId];
  saveState();
  const remaining = Array.from(elements.windowLayer.querySelectorAll('.window'));
  if (remaining.length > 0) {
    const topWindow = remaining.reduce((highest, candidate) => {
      if (!highest) return candidate;
      return Number(candidate.style.zIndex || 0) > Number(highest.style.zIndex || 0) ? candidate : highest;
    }, null);
    const nextApp = topWindow ? apps[topWindow.dataset.app] : null;
    elements.topBarLabel.textContent = nextApp ? nextApp.name : 'Ready';
  } else {
    elements.topBarLabel.textContent = 'Ready';
  }
}

function minimizeWindow(windowEl) {
  if (windowEl.dataset.hidden === 'true') {
    delete windowEl.dataset.hidden;
  } else {
    windowEl.dataset.hidden = 'true';
  }
}

function toggleFloat(windowEl) {
  const floating = windowEl.classList.toggle('window--floating');
  windowEl.style.transform = floating ? 'scale(1.02)' : '';
}

function makeWindowDraggable(windowEl) {
  const titlebar = windowEl.querySelector('.window__titlebar');
  let offsetX;
  let offsetY;
  function onPointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    offsetX = event.clientX - windowEl.offsetLeft;
    offsetY = event.clientY - windowEl.offsetTop;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  }
  function onPointerMove(event) {
    const x = Math.min(window.innerWidth - 120, Math.max(12, event.clientX - offsetX));
    const y = Math.min(window.innerHeight - 120, Math.max(12, event.clientY - offsetY));
    windowEl.style.left = `${x}px`;
    windowEl.style.top = `${y}px`;
  }
  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    saveWindowState(windowEl);
    saveState();
  }
  titlebar.addEventListener('pointerdown', onPointerDown);
}

function makeWindowResizable(windowEl) {
  const handle = windowEl.querySelector('.window__resize-handle');
  let startX;
  let startY;
  let startWidth;
  let startHeight;
  handle.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startX = event.clientX;
    startY = event.clientY;
    startWidth = windowEl.offsetWidth;
    startHeight = windowEl.offsetHeight;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  });
  function onPointerMove(event) {
    const width = Math.max(360, startWidth + (event.clientX - startX));
    const height = Math.max(260, startHeight + (event.clientY - startY));
    windowEl.style.width = `${width}px`;
    windowEl.style.height = `${height}px`;
  }
  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    saveWindowState(windowEl);
    saveState();
  }
}

function saveWindowState(windowEl) {
  const appId = windowEl.dataset.app;
  state.windows[appId] = {
    position: { x: windowEl.offsetLeft, y: windowEl.offsetTop },
    size: { width: windowEl.offsetWidth, height: windowEl.offsetHeight }
  };
}

function restoreWindows() {
  for (const [appId, persisted] of Object.entries(state.windows)) {
    const definition = apps[appId];
    if (!definition) continue;
    createWindow(appId, definition, persisted);
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>\"']/g, (char) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[char] || char;
  });
}

function markdownToHtml(markdown) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('# ')) {
        return `<h1>${escapeHtml(trimmed.slice(2).trim())}</h1>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h2>${escapeHtml(trimmed.slice(3).trim())}</h2>`;
      }
      if (trimmed.startsWith('- ')) {
        const items = trimmed
          .split(/\n- /)
          .map((item) => `<li>${escapeHtml(item.replace(/^- /, '').trim())}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${escapeHtml(trimmed).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>')}</p>`;
    })
    .join('');
}

function findFileNode(path) {
  let node = state.files.tree;
  for (const part of path.slice(1)) {
    if (!node.children) break;
    node = node.children.find((child) => child.name === part);
    if (!node) break;
  }
  return node;
}

apps.notes = {
  id: 'notes',
  name: 'Notes',
  width: 680,
  height: 480,
  render(container) {
    container.innerHTML = `
      <div class="app-grid">
        <aside class="app-panel">
          <input class="notes__search" type="search" placeholder="Search notes" value="${state.notes.search || ''}" />
          <button class="notes__create" type="button">＋ New Note</button>
          <div class="notes__list"></div>
        </aside>
        <div class="notes__editor">
          <input class="notes__title" placeholder="Title" />
          <textarea class="notes__content" placeholder="Write in Markdown..."></textarea>
          <div class="notes__preview"></div>
        </div>
      </div>
    `;
    const listEl = container.querySelector('.notes__list');
    const titleEl = container.querySelector('.notes__title');
    const contentEl = container.querySelector('.notes__content');
    const previewEl = container.querySelector('.notes__preview');
    const searchEl = container.querySelector('.notes__search');
    const createBtn = container.querySelector('.notes__create');

    function ensureActive() {
      if (!state.notes.activeId) {
        state.notes.activeId = state.notes.notes[0]?.id || null;
      }
    }

    function renderList() {
      const term = state.notes.search.toLowerCase();
      listEl.innerHTML = '';
      state.notes.notes
        .filter((note) => note.title.toLowerCase().includes(term) || note.content.toLowerCase().includes(term))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .forEach((note) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'notes__item' + (note.id === state.notes.activeId ? ' notes__item--active' : '');
          item.innerHTML = `<strong>${escapeHtml(note.title || 'Untitled')}</strong><br /><small>${new Date(
            note.updatedAt
          ).toLocaleString()}</small>`;
          item.addEventListener('click', () => {
            state.notes.activeId = note.id;
            renderList();
            fillEditor();
            saveState();
          });
          listEl.appendChild(item);
        });
    }

    function fillEditor() {
      ensureActive();
      const note = state.notes.notes.find((n) => n.id === state.notes.activeId);
      if (!note) {
        titleEl.value = '';
        contentEl.value = '';
        previewEl.innerHTML = '<em>Select or create a note</em>';
        return;
      }
      titleEl.value = note.title;
      contentEl.value = note.content;
      previewEl.innerHTML = markdownToHtml(note.content || '');
    }

    function persist(note) {
      note.updatedAt = Date.now();
      saveState();
      renderList();
    }

    searchEl.addEventListener('input', (event) => {
      state.notes.search = event.target.value;
      renderList();
      saveState();
    });

    createBtn.addEventListener('click', () => {
      const newNote = { id: makeId(), title: 'Untitled note', content: '', updatedAt: Date.now() };
      state.notes.notes.unshift(newNote);
      state.notes.activeId = newNote.id;
      renderList();
      fillEditor();
      saveState();
      soundEngine.play(640);
    });

    titleEl.addEventListener('input', () => {
      const note = state.notes.notes.find((n) => n.id === state.notes.activeId);
      if (!note) return;
      note.title = titleEl.value;
      persist(note);
    });

    contentEl.addEventListener('input', () => {
      const note = state.notes.notes.find((n) => n.id === state.notes.activeId);
      if (!note) return;
      note.content = contentEl.value;
      previewEl.innerHTML = markdownToHtml(note.content || '');
      persist(note);
    });

    renderList();
    fillEditor();
  },
  open(_, options) {
    if (options.create) {
      const createBtn = document.querySelector('.notes__create');
      createBtn?.click();
    }
  }
};

apps.tasks = {
  id: 'tasks',
  name: 'Tasks',
  width: 640,
  height: 460,
  render(container) {
    container.innerHTML = `
      <form class="tasks__composer">
        <input class="tasks__title" placeholder="New task" required />
        <input class="tasks__due" type="date" />
        <button type="submit">Add</button>
      </form>
      <div class="tasks__lists"></div>
    `;
    const form = container.querySelector('.tasks__composer');
    const titleInput = container.querySelector('.tasks__title');
    const dueInput = container.querySelector('.tasks__due');
    const listsEl = container.querySelector('.tasks__lists');

    const columns = [
      { id: 'inbox', label: 'Inbox', emoji: '📥' },
      { id: 'today', label: 'Today', emoji: '☀️' },
      { id: 'done', label: 'Done', emoji: '✅' }
    ];

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = titleInput.value.trim();
      if (!title) return;
      state.tasks.items.push({ id: makeId(), title, due: dueInput.value || null, status: 'inbox' });
      titleInput.value = '';
      dueInput.value = '';
      saveState();
      renderLists();
      soundEngine.play(620);
    });

    function renderLists() {
      listsEl.innerHTML = '';
      columns.forEach((column) => {
        const columnEl = document.createElement('section');
        columnEl.className = 'tasks__column';
        const title = document.createElement('h3');
        title.textContent = `${column.emoji} ${column.label}`;
        columnEl.appendChild(title);
        state.tasks.items
          .filter((task) => task.status === column.id)
          .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
          .forEach((task) => {
            const card = document.createElement('article');
            card.className = 'task-card';
            card.innerHTML = `
              <label>
                <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} />
                <span>${escapeHtml(task.title)}</span>
              </label>
              <div>${task.due ? `Due ${task.due}` : ''}</div>
              <footer>
                <button type="button" data-action="inbox">Inbox</button>
                <button type="button" data-action="today">Today</button>
                <button type="button" data-action="done">Done</button>
              </footer>
            `;
            const checkbox = card.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
              task.status = checkbox.checked ? 'done' : 'inbox';
              saveState();
              renderLists();
            });
            card.querySelectorAll('button[data-action]').forEach((btn) => {
              btn.addEventListener('click', () => {
                task.status = btn.dataset.action;
                saveState();
                renderLists();
              });
            });
            columnEl.appendChild(card);
          });
        listsEl.appendChild(columnEl);
      });
    }

    renderLists();
  },
  open(instance, options) {
    if (options.newTask) {
      const input = instance.element.querySelector('.tasks__title');
      input?.focus();
    }
  }
};

apps.files = {
  id: 'files',
  name: 'Files',
  width: 720,
  height: 480,
  render(container) {
    container.innerHTML = `
      <div class="files__breadcrumb"></div>
      <div class="files__items"></div>
    `;
    const breadcrumbEl = container.querySelector('.files__breadcrumb');
    const itemsEl = container.querySelector('.files__items');

    function renderBreadcrumb() {
      breadcrumbEl.innerHTML = '';
      state.files.currentPath.forEach((part, index) => {
        const button = document.createElement('button');
        button.textContent = part;
        button.type = 'button';
        button.addEventListener('click', () => {
          state.files.currentPath = state.files.currentPath.slice(0, index + 1);
          render();
        });
        breadcrumbEl.appendChild(button);
        if (index < state.files.currentPath.length - 1) {
          const separator = document.createElement('span');
          separator.textContent = '›';
          breadcrumbEl.appendChild(separator);
        }
      });
    }

    function renderItems() {
      const current = findFileNode(state.files.currentPath);
      if (!current) return;
      itemsEl.innerHTML = '';
      current.children?.forEach((child) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'files__item';
        item.innerHTML = `<strong>${child.type === 'folder' ? '📁' : '📄'} ${escapeHtml(child.name)}</strong>`;
        if (child.type === 'folder') {
          item.addEventListener('click', () => {
            state.files.currentPath = [...state.files.currentPath, child.name];
            render();
          });
        } else {
          item.addEventListener('click', () => {
            openFilePreview(child);
          });
        }
        itemsEl.appendChild(item);
      });
    }

    function openFilePreview(file) {
      const preview = document.createElement('div');
      preview.style.position = 'fixed';
      preview.style.inset = '0';
      preview.style.display = 'grid';
      preview.style.placeItems = 'center';
      preview.style.background = 'rgba(12, 19, 38, 0.6)';
      preview.style.backdropFilter = 'blur(16px)';
      preview.style.zIndex = 300;
      const panel = document.createElement('div');
      panel.style.width = '420px';
      panel.style.maxWidth = '90vw';
      panel.style.background = 'rgba(255, 255, 255, 0.94)';
      panel.style.padding = '24px';
      panel.style.borderRadius = '18px';
      panel.innerHTML = `
        <h2>${escapeHtml(file.name)}</h2>
        <pre style="white-space: pre-wrap;">${escapeHtml(file.content || '')}</pre>
        <button type="button">Close</button>
      `;
      panel.querySelector('button').addEventListener('click', () => preview.remove());
      preview.addEventListener('click', (event) => {
        if (event.target === preview) preview.remove();
      });
      preview.appendChild(panel);
      document.body.appendChild(preview);
    }

    function render() {
      renderBreadcrumb();
      renderItems();
      saveState();
    }

    render();
  },
  open(instance, options) {
    if (options.path) {
      state.files.currentPath = options.path;
      saveState();
      instance.definition.render(instance.element.querySelector('.window__body'), instance.element);
    }
  }
};

apps.terminal = {
  id: 'terminal',
  name: 'Terminal',
  width: 640,
  height: 420,
  render(container) {
    container.innerHTML = `
      <div class="terminal__log"></div>
      <form class="terminal__form">
        <input class="terminal__input" type="text" autocomplete="off" placeholder="Type a command" />
      </form>
    `;
    const logEl = container.querySelector('.terminal__log');
    const form = container.querySelector('.terminal__form');
    const input = container.querySelector('.terminal__input');

    function renderLog() {
      logEl.innerHTML = state.terminal.log.map((line) => `<div>${escapeHtml(line)}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    function append(line) {
      state.terminal.log.push(line);
      saveState();
      renderLog();
    }

    const commands = {
      help() {
        append('Commands: help, ls, open <app>, clear');
      },
      ls() {
        append('Applications: ' + DEFAULT_ICONS.map((icon) => icon.app).join(', '));
      },
      open(args) {
        const app = args[0];
        if (apps[app]) {
          append(`Opening ${app}…`);
          openApp(app);
        } else {
          append(`Unknown app: ${app}`);
        }
      },
      clear() {
        state.terminal.log = [];
        renderLog();
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      append(`> ${value}`);
      state.terminal.history.push(value);
      state.terminal.pointer = null;
      const [command, ...args] = value.split(/\s+/);
      const handler = commands[command];
      if (handler) {
        handler(args);
      } else {
        append(`Command not found: ${command}`);
      }
      input.value = '';
      saveState();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (state.terminal.pointer === null) {
          state.terminal.pointer = state.terminal.history.length - 1;
        } else {
          state.terminal.pointer = Math.max(0, state.terminal.pointer - 1);
        }
        input.value = state.terminal.history[state.terminal.pointer] || '';
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (state.terminal.pointer === null) return;
        state.terminal.pointer = Math.min(state.terminal.history.length - 1, state.terminal.pointer + 1);
        input.value = state.terminal.history[state.terminal.pointer] || '';
      }
    });

    renderLog();
  }
};

apps.browser = {
  id: 'browser',
  name: 'Browser',
  width: 780,
  height: 520,
  render(container) {
    container.innerHTML = `
      <form class="browser__chrome">
        <input class="browser__address" type="url" value="${state.browser.history[state.browser.index]}" />
        <button type="submit">Go</button>
        <button type="button" data-action="back">←</button>
        <button type="button" data-action="forward">→</button>
      </form>
      <div class="browser__frame"><iframe sandbox="allow-same-origin allow-scripts allow-forms"></iframe></div>
    `;
    const addressEl = container.querySelector('.browser__address');
    const frame = container.querySelector('iframe');

    function navigate(url) {
      if (!url) return;
      if (url === 'about:home') {
        frame.srcdoc = `
          <style>body{font-family:sans-serif;margin:0;padding:40px;background:linear-gradient(135deg,#fdfbfb,#ebedee);}main{max-width:520px;margin:auto;background:white;border-radius:18px;padding:32px;box-shadow:0 26px 60px rgba(12,19,38,0.2);}h1{margin-top:0;}</style>
          <main>
            <h1>Welcome to GlowOS Browser</h1>
            <p>Try visiting <strong>https://wikipedia.org</strong> or <strong>https://developer.mozilla.org</strong>.</p>
          </main>
        `;
      } else {
        const href = url.startsWith('http') ? url : `https://${url}`;
        frame.src = href;
      }
    }

    container.querySelector('.browser__chrome').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = addressEl.value.trim() || 'about:home';
      state.browser.history = state.browser.history.slice(0, state.browser.index + 1);
      state.browser.history.push(value);
      state.browser.index = state.browser.history.length - 1;
      navigate(value);
      saveState();
    });

    container.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'back') {
          state.browser.index = Math.max(0, state.browser.index - 1);
        } else {
          state.browser.index = Math.min(state.browser.history.length - 1, state.browser.index + 1);
        }
        addressEl.value = state.browser.history[state.browser.index];
        navigate(addressEl.value);
        saveState();
      });
    });

    navigate(state.browser.history[state.browser.index] || 'about:home');
  },
  open(instance, options) {
    if (options.url) {
      const url = options.url;
      state.browser.history = state.browser.history.slice(0, state.browser.index + 1);
      state.browser.history.push(url);
      state.browser.index = state.browser.history.length - 1;
      const address = instance.element.querySelector('.browser__address');
      if (address) {
        address.value = url;
      }
      const iframe = instance.element.querySelector('iframe');
      if (iframe) {
        iframe.src = url.startsWith('http') ? url : `https://${url}`;
      }
      saveState();
    }
  }
};

apps.settings = {
  id: 'settings',
  name: 'Settings',
  width: 620,
  height: 480,
  render(container) {
    container.innerHTML = `
      <section class="settings">
        <h2>Wallpaper</h2>
        <div class="settings__wallpapers"></div>
        <h2>Theme</h2>
        <div class="settings__themes">
          <button type="button" data-theme="light">Light</button>
          <button type="button" data-theme="dark">Dark</button>
        </div>
        <h2>Sound</h2>
        <label class="settings__sound">
          <input type="checkbox" ${state.settings.sound ? 'checked' : ''} /> Enable playful sounds
        </label>
      </section>
    `;
    const wallpapersEl = container.querySelector('.settings__wallpapers');
    const soundEl = container.querySelector('.settings__sound input');

    WALLPAPERS.forEach((wallpaper) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'wallpaper-option' + (state.settings.wallpaper === wallpaper.id ? ' wallpaper-option--active' : '');
      option.style.background = wallpaper.value;
      option.title = wallpaper.name;
      option.addEventListener('click', () => {
        state.settings.wallpaper = wallpaper.id;
        applyWallpaper();
        saveState();
        apps.settings.render(container);
      });
      wallpapersEl.appendChild(option);
    });

    container.querySelectorAll('[data-theme]').forEach((button) => {
      button.addEventListener('click', () => {
        setTheme(button.dataset.theme);
        apps.settings.render(container);
      });
    });

    soundEl.addEventListener('change', () => {
      state.settings.sound = soundEl.checked;
      saveState();
    });
  }
};

init();
