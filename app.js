(() => {
  const STORAGE_KEY = 'glowos_state_v1';
  const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
  const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10));
  const WALLPAPERS = [
    { id: 'aurora', label: 'Aurora', url: 'linear-gradient(135deg, #2e1760, #8e2de2, #4a00e0)' },
    { id: 'sunset', label: 'Sunset', url: 'linear-gradient(160deg, #ff9a9e 0%, #fad0c4 100%)' },
    { id: 'ocean', label: 'Ocean', url: 'linear-gradient(145deg, #13547a 0%, #80d0c7 100%)' },
    { id: 'forest', label: 'Forest', url: 'linear-gradient(150deg, #5a3f37 0%, #2c7744 100%)' },
    { id: 'candy', label: 'Candy', url: 'linear-gradient(145deg, #f6d365 0%, #fda085 100%)' }
  ];

  const DEFAULT_STATE = {
    settings: {
      theme: 'light',
      wallpaper: WALLPAPERS[0].id,
      sound: true
    },
    desktop: {
      icons: {},
      wallpaperCustom: ''
    },
    windows: {},
    notes: {
      notes: [
        {
          id: makeId(),
          title: 'Welcome note',
          content: '# Hello!\n\nThanks for visiting GlowOS. Use **Cmd/Ctrl+K** to summon the spotlight.\n\nYou can keep notes, track tasks, and customise the vibe in Settings.',
          updatedAt: Date.now()
        }
      ],
      activeId: null,
      search: ''
    },
    tasks: {
      items: [
        {
          id: makeId(),
          title: 'Try the Notes app',
          due: null,
          status: 'inbox'
        },
        {
          id: makeId(),
          title: 'Switch wallpapers in Settings',
          due: null,
          status: 'today'
        }
      ],
      filter: 'inbox'
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
          {
            type: 'file',
            name: 'readme.md',
            content: 'GlowOS is your tiny desk companion. ✨'
          }
        ]
      },
      currentPath: ['Home']
    },
    terminal: {
      history: [],
      log: ['GlowOS terminal ready. Type `help` to discover commands.'],
      pointer: null
    },
    browser: {
      history: ['about:home'],
      index: 0
    }
  };

  const soundEngine = (() => {
    let ctx;
    function play(freq = 530, duration = 0.08) {
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

  const apps = {
    notes: {
      id: 'notes',
      name: 'Notes',
      glyph: '📝',
      width: 640,
      height: 460,
      render(container, winEl) {
        container.innerHTML = `
          <div class="notes-app">
            <div class="notes-sidebar">
              <input class="note-search" type="search" placeholder="Search notes" value="${state.notes.search || ''}" />
              <button class="create-note">＋ New Note</button>
              <div class="notes-list"></div>
            </div>
            <div class="note-editor">
              <input class="note-title" placeholder="Title" />
              <textarea class="note-content" placeholder="Write in Markdown..."></textarea>
              <div class="note-preview"></div>
            </div>
          </div>
        `;

        const listEl = container.querySelector('.notes-list');
        const searchEl = container.querySelector('.note-search');
        const titleEl = container.querySelector('.note-title');
        const bodyEl = container.querySelector('.note-content');
        const previewEl = container.querySelector('.note-preview');
        const createBtn = container.querySelector('.create-note');

        function ensureActive() {
          if (!state.notes.activeId) {
            state.notes.activeId = state.notes.notes[0]?.id || null;
          }
        }

        function renderList() {
          const term = state.notes.search.toLowerCase();
          listEl.innerHTML = '';
          state.notes.notes
            .filter((n) => n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term))
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .forEach((note) => {
              const el = document.createElement('button');
              el.className = 'note-item' + (note.id === state.notes.activeId ? ' active' : '');
              el.innerHTML = `<strong>${escapeHtml(note.title || 'Untitled')}</strong><small>${new Date(note.updatedAt).toLocaleString()}</small>`;
              el.addEventListener('click', () => {
                state.notes.activeId = note.id;
                renderList();
                fillEditor();
                saveState();
              });
              listEl.appendChild(el);
            });
        }

        function fillEditor() {
          ensureActive();
          const note = state.notes.notes.find((n) => n.id === state.notes.activeId);
          if (!note) {
            titleEl.value = '';
            bodyEl.value = '';
            previewEl.innerHTML = '<em>Select or create a note</em>';
            return;
          }
          titleEl.value = note.title;
          bodyEl.value = note.content;
          previewEl.innerHTML = markdownToHtml(note.content || '');
        }

        searchEl.addEventListener('input', (e) => {
          state.notes.search = e.target.value;
          renderList();
          saveState();
        });

        createBtn.addEventListener('click', () => {
          const newNote = {
            id: makeId(),
            title: 'Untitled note',
            content: '',
            updatedAt: Date.now()
          };
          state.notes.notes.unshift(newNote);
          state.notes.activeId = newNote.id;
          renderList();
          fillEditor();
          saveState();
          soundEngine.play(610);
        });

        titleEl.addEventListener('input', () => {
          const note = state.notes.notes.find((n) => n.id === state.notes.activeId);
          if (!note) return;
          note.title = titleEl.value;
          note.updatedAt = Date.now();
          renderList();
          previewEl.innerHTML = markdownToHtml(note.content || '');
          saveStateDebounced();
        });

        bodyEl.addEventListener('input', () => {
          const note = state.notes.notes.find((n) => n.id === state.notes.activeId);
          if (!note) return;
          note.content = bodyEl.value;
          note.updatedAt = Date.now();
          previewEl.innerHTML = markdownToHtml(note.content || '');
          saveStateDebounced();
        });

        listEl.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          const button = event.target.closest('.note-item');
          if (!button) return;
          const noteIndex = Array.from(listEl.children).indexOf(button);
          const note = state.notes.notes
            .filter((n) => n.title.toLowerCase().includes(state.notes.search.toLowerCase()) || n.content.toLowerCase().includes(state.notes.search.toLowerCase()))
            .sort((a, b) => b.updatedAt - a.updatedAt)[noteIndex];
          if (!note) return;
          if (confirm('Delete this note?')) {
            state.notes.notes = state.notes.notes.filter((n) => n.id !== note.id);
            if (state.notes.activeId === note.id) {
              state.notes.activeId = state.notes.notes[0]?.id || null;
            }
            renderList();
            fillEditor();
            saveState();
          }
        });

        renderList();
        fillEditor();
      }
    },
    tasks: {
      id: 'tasks',
      name: 'Tasks',
      glyph: '✅',
      width: 560,
      height: 440,
      render(container) {
        container.innerHTML = `
          <div class="tasks-app">
            <div class="task-lists">
              <button data-filter="inbox">Inbox</button>
              <button data-filter="today">Today</button>
              <button data-filter="done">Done</button>
              <button class="new-task">＋ New task</button>
            </div>
            <div class="task-view">
              <div class="task-items"></div>
            </div>
          </div>
        `;

        const listButtons = container.querySelectorAll('.task-lists button[data-filter]');
        const taskContainer = container.querySelector('.task-items');
        const newBtn = container.querySelector('.new-task');

        function renderTasks() {
          taskContainer.innerHTML = '';
          listButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.filter === state.tasks.filter));
          state.tasks.items
            .filter((task) => (state.tasks.filter === 'done' ? task.status === 'done' : task.status === state.tasks.filter))
            .forEach((task) => {
              const el = document.createElement('div');
              el.className = 'task-item' + (task.status === 'done' ? ' done' : '');
              el.innerHTML = `
                <header>
                  <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} />
                  <span>${escapeHtml(task.title)}</span>
                </header>
                ${task.due ? `<time>Due ${formatDate(task.due)}</time>` : ''}
              `;
              const checkbox = el.querySelector('input');
              checkbox.addEventListener('change', () => {
                task.status = checkbox.checked ? 'done' : state.tasks.filter === 'today' ? 'today' : 'inbox';
                saveState();
                renderTasks();
              });
              el.addEventListener('dblclick', () => {
                const newTitle = prompt('Edit task', task.title);
                if (newTitle !== null) {
                  task.title = newTitle.trim();
                  saveState();
                  renderTasks();
                }
              });
              el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm('Delete this task?')) {
                  state.tasks.items = state.tasks.items.filter((t) => t.id !== task.id);
                  saveState();
                  renderTasks();
                }
              });
              taskContainer.appendChild(el);
            });
        }

        listButtons.forEach((btn) =>
          btn.addEventListener('click', () => {
            state.tasks.filter = btn.dataset.filter;
            renderTasks();
            saveState();
          })
        );

        newBtn.addEventListener('click', () => {
          const title = prompt('Task title?');
          if (!title) return;
          const due = prompt('Due date (YYYY-MM-DD optional)');
          state.tasks.items.push({
            id: makeId(),
            title: title.trim(),
            due: due ? due.trim() : null,
            status: state.tasks.filter === 'today' ? 'today' : 'inbox'
          });
          saveState();
          renderTasks();
          soundEngine.play(660);
        });

        renderTasks();
      }
    },
    files: {
      id: 'files',
      name: 'Files',
      glyph: '🗂️',
      width: 600,
      height: 440,
      render(container) {
        container.innerHTML = `
          <div class="files-app">
            <div class="files-sidebar">
              <button class="root" data-path="Home">🏠 Home</button>
              <button class="new-folder">＋ New folder</button>
              <button class="new-file">＋ New file</button>
            </div>
            <div class="files-content">
              <div class="breadcrumb"></div>
              <div class="file-grid"></div>
            </div>
          </div>
        `;

        const breadcrumbEl = container.querySelector('.breadcrumb');
        const gridEl = container.querySelector('.file-grid');
        const newFolderBtn = container.querySelector('.new-folder');
        const newFileBtn = container.querySelector('.new-file');

        function currentFolder() {
          return traversePath(state.files.currentPath);
        }

        function renderBreadcrumb() {
          breadcrumbEl.innerHTML = '';
          state.files.currentPath.forEach((segment, index) => {
            const span = document.createElement('button');
            span.textContent = segment;
            span.addEventListener('click', () => {
              state.files.currentPath = state.files.currentPath.slice(0, index + 1);
              render();
              saveState();
            });
            breadcrumbEl.appendChild(span);
            if (index < state.files.currentPath.length - 1) {
              const divider = document.createElement('span');
              divider.textContent = '›';
              divider.style.opacity = '0.6';
              divider.style.margin = '0 6px';
              breadcrumbEl.appendChild(divider);
            }
          });
        }

        function render() {
          renderBreadcrumb();
          const folder = currentFolder();
          gridEl.innerHTML = '';
          folder.children?.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'file-card ' + (item.type === 'folder' ? 'folder' : '');
            card.innerHTML = `<strong>${item.type === 'folder' ? '📁' : '📄'} ${escapeHtml(item.name)}</strong>`;
            card.addEventListener('dblclick', () => {
              if (item.type === 'folder') {
                state.files.currentPath = [...state.files.currentPath, item.name];
                render();
                saveState();
              } else {
                alert(item.content || '(empty file)');
              }
            });
            card.addEventListener('contextmenu', (event) => {
              event.preventDefault();
              const choice = prompt('Action? (rename, delete, move)', 'rename');
              if (!choice) return;
              if (choice === 'rename') {
                const newName = prompt('Rename to', item.name);
                if (!newName) return;
                item.name = newName.trim();
              } else if (choice === 'delete') {
                if (confirm('Delete item?')) {
                  folder.children = folder.children.filter((child) => child !== item);
                }
              } else if (choice === 'move') {
                const destination = prompt('Move to folder path (e.g., Home/Memories)');
                if (destination) {
                  const path = destination.split('/').filter(Boolean);
                  const target = traversePath(path);
                  if (target && target.type === 'folder') {
                    folder.children = folder.children.filter((child) => child !== item);
                    target.children = target.children || [];
                    target.children.push(item);
                  } else {
                    alert('Folder not found');
                  }
                }
              }
              saveState();
              render();
            });
            gridEl.appendChild(card);
          });
        }

        newFolderBtn.addEventListener('click', () => {
          const name = prompt('Folder name');
          if (!name) return;
          const folder = currentFolder();
          folder.children = folder.children || [];
          folder.children.push({ type: 'folder', name: name.trim(), children: [] });
          saveState();
          render();
        });

        newFileBtn.addEventListener('click', () => {
          const name = prompt('File name');
          if (!name) return;
          const content = prompt('Initial contents');
          const folder = currentFolder();
          folder.children = folder.children || [];
          folder.children.push({ type: 'file', name: name.trim(), content: content || '' });
          saveState();
          render();
        });

        container.querySelector('.files-sidebar .root').addEventListener('click', () => {
          state.files.currentPath = ['Home'];
          render();
          saveState();
        });

        render();
      }
    },
    terminal: {
      id: 'terminal',
      name: 'Terminal',
      glyph: '🖥️',
      width: 520,
      height: 360,
      render(container, winEl) {
        container.innerHTML = `
          <div class="terminal-app">
            <div class="terminal-log"></div>
            <div class="terminal-input">
              <span>λ</span>
              <input type="text" autocomplete="off" />
            </div>
          </div>
        `;
        const logEl = container.querySelector('.terminal-log');
        const inputEl = container.querySelector('input');

        function renderLog() {
          logEl.innerHTML = '';
          state.terminal.log.forEach((entry) => {
            const line = document.createElement('div');
            line.textContent = entry;
            logEl.appendChild(line);
          });
          logEl.scrollTop = logEl.scrollHeight;
        }

        function execute(cmd) {
          const response = handleCommand(cmd.trim());
          state.terminal.log.push(`λ ${cmd}`);
          if (Array.isArray(response)) {
            state.terminal.log.push(...response);
          } else if (response) {
            state.terminal.log.push(response);
          }
          state.terminal.history.push(cmd);
          state.terminal.pointer = null;
          renderLog();
          saveState();
        }

        inputEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            const value = event.target.value;
            event.target.value = '';
            execute(value);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            const history = state.terminal.history;
            if (!history.length) return;
            if (state.terminal.pointer === null) state.terminal.pointer = history.length;
            state.terminal.pointer = Math.max(0, state.terminal.pointer - 1);
            event.target.value = history[state.terminal.pointer];
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            const history = state.terminal.history;
            if (state.terminal.pointer === null) return;
            state.terminal.pointer = Math.min(history.length, state.terminal.pointer + 1);
            event.target.value = history[state.terminal.pointer] || '';
          }
        });

        renderLog();
        inputEl.focus();
        requestAnimationFrame(() => inputEl.focus());
      }
    },
    browser: {
      id: 'browser',
      name: 'Browser',
      glyph: '🌐',
      width: 640,
      height: 420,
      render(container) {
        container.innerHTML = `
          <div class="browser-app">
            <div class="browser-controls">
              <button class="nav-back">←</button>
              <button class="nav-forward">→</button>
              <input class="address" value="${state.browser.history[state.browser.index] || 'about:home'}" />
              <button class="nav-go">Go</button>
            </div>
            <div class="browser-view"></div>
          </div>
        `;
        const viewEl = container.querySelector('.browser-view');
        const addressEl = container.querySelector('.address');
        const goBtn = container.querySelector('.nav-go');
        const backBtn = container.querySelector('.nav-back');
        const forwardBtn = container.querySelector('.nav-forward');

        function renderPage(url) {
          addressEl.value = url;
          viewEl.innerHTML = synthesizePage(url);
        }

        function navigate(url) {
          url = url.trim() || 'about:home';
          if (state.browser.index < state.browser.history.length - 1) {
            state.browser.history = state.browser.history.slice(0, state.browser.index + 1);
          }
          state.browser.history.push(url);
          state.browser.index = state.browser.history.length - 1;
          renderPage(url);
          saveState();
        }

        goBtn.addEventListener('click', () => navigate(addressEl.value));
        addressEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') navigate(addressEl.value);
        });
        backBtn.addEventListener('click', () => {
          if (state.browser.index > 0) {
            state.browser.index--;
            renderPage(state.browser.history[state.browser.index]);
            saveState();
          }
        });
        forwardBtn.addEventListener('click', () => {
          if (state.browser.index < state.browser.history.length - 1) {
            state.browser.index++;
            renderPage(state.browser.history[state.browser.index]);
            saveState();
          }
        });

        renderPage(state.browser.history[state.browser.index] || 'about:home');
      }
    },
    settings: {
      id: 'settings',
      name: 'Settings',
      glyph: '⚙️',
      width: 520,
      height: 420,
      render(container) {
        const wallpaperButtons = WALLPAPERS.map(
          (wall) => `
            <button class="wallpaper-option ${state.settings.wallpaper === wall.id ? 'active' : ''}" data-wallpaper="${wall.id}" style="background-image:${wall.url.includes('gradient') ? wall.url : `url(${wall.url})`}">
              <span class="sr-only">${wall.label}</span>
            </button>
          `
        ).join('');

        container.innerHTML = `
          <div class="settings-app">
            <div class="settings-section">
              <h3>Wallpaper</h3>
              <div class="wallpaper-grid">${wallpaperButtons}</div>
            </div>
            <div class="settings-section">
              <h3>Appearance</h3>
              <div class="toggle-row">
                <span>Theme</span>
                <select class="theme-select">
                  <option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                  <option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                </select>
              </div>
              <div class="toggle-row">
                <span>Sound effects</span>
                <label>
                  <input type="checkbox" class="sound-toggle" ${state.settings.sound ? 'checked' : ''} />
                  <span>Enable chimes</span>
                </label>
              </div>
            </div>
          </div>
        `;

        container.querySelectorAll('.wallpaper-option').forEach((button) => {
          button.addEventListener('click', () => {
            state.settings.wallpaper = button.dataset.wallpaper;
            applyWallpaper();
            saveState();
            apps.settings.render(container);
          });
        });

        container.querySelector('.theme-select').addEventListener('change', (e) => {
          state.settings.theme = e.target.value;
          applyTheme();
          saveState();
        });

        container.querySelector('.sound-toggle').addEventListener('change', (e) => {
          state.settings.sound = e.target.checked;
          saveState();
          soundEngine.play(420, 0.1);
        });
      }
    }
  };

  const quickActions = [
    {
      id: 'new-note',
      label: 'Create note',
      handler: () => {
        const win = openWindow('notes');
        setTimeout(() => win?.querySelector('.note-editor textarea')?.focus(), 160);
      }
    },
    {
      id: 'new-task',
      label: 'Add task',
      handler: () => {
        openWindow('tasks');
        setTimeout(() => {
          const title = prompt('Task title?');
          if (!title) return;
          state.tasks.items.push({ id: makeId(), title: title.trim(), due: null, status: state.tasks.filter || 'inbox' });
          saveState();
          const container = document.querySelector('[data-app="tasks"] .window-content');
          if (container) apps.tasks.render(container);
        }, 140);
      }
    },
    { id: 'toggle-theme', label: 'Toggle theme', handler: () => {
      state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
      applyTheme();
      saveState();
    } },
    { id: 'open-settings', label: 'Open Settings', handler: () => openWindow('settings') }
  ];

  let state = loadState();
  let zTracker = 10;
  let saveTimeout = null;
  let selectedDesktopIcon = null;

  const iconLayer = document.getElementById('icon-layer');
  const windowLayer = document.getElementById('window-layer');
  const dock = document.getElementById('dock');
  const launcher = document.getElementById('launcher');
  const launcherInput = document.getElementById('launcher-input');
  const launcherResults = document.getElementById('launcher-results');
  const activeAppDisplay = document.getElementById('active-app-display');
  const desktop = document.getElementById('desktop');
  const wallpaperOverlay = document.getElementById('wallpaper-overlay');
  const desktopMenu = document.getElementById('desktop-menu');
  const desktopMenuList = desktopMenu?.querySelector('ul');

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return mergeDefaults(parsed);
      }
    } catch (error) {
      console.error('Failed to load state', error);
    }
    return clone(DEFAULT_STATE);
  }

  function mergeDefaults(saved) {
    return {
      ...clone(DEFAULT_STATE),
      ...saved,
      settings: { ...DEFAULT_STATE.settings, ...saved.settings },
      desktop: { ...DEFAULT_STATE.desktop, ...saved.desktop },
      windows: { ...DEFAULT_STATE.windows, ...saved.windows },
      notes: { ...DEFAULT_STATE.notes, ...saved.notes },
      tasks: { ...DEFAULT_STATE.tasks, ...saved.tasks },
      files: { ...DEFAULT_STATE.files, ...saved.files },
      terminal: { ...DEFAULT_STATE.terminal, ...saved.terminal },
      browser: { ...DEFAULT_STATE.browser, ...saved.browser }
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function saveStateDebounced() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveState, 400);
  }

  function applyTheme() {
    document.body.classList.toggle('dark', state.settings.theme === 'dark');
  }

  function applyWallpaper() {
    const wallpaper = WALLPAPERS.find((w) => w.id === state.settings.wallpaper) || WALLPAPERS[0];
    document.getElementById('wallpaper-overlay').style.backgroundImage = wallpaper.url;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function markdownToHtml(markdown) {
    const safe = escapeHtml(markdown);
    return safe
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br />');
  }

  function escapeHtml(str = '') {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function traversePath(path) {
    if (!Array.isArray(path)) path = path.split('/');
    let node = state.files.tree;
    if (path[0] !== 'Home') return null;
    for (let i = 1; i < path.length; i++) {
      const segment = path[i];
      node = node.children?.find((child) => child.name === segment);
      if (!node || node.type !== 'folder') return i === path.length - 1 ? node : null;
    }
    return node;
  }

  function synthesizePage(url) {
    const PAGES = {
      'about:home': `
        <h1>GlowOS Browser</h1>
        <p>Welcome to your in-app browser. For safety, pages are handcrafted.</p>
        <ul>
          <li><a data-open="notes" href="#">Open Notes</a></li>
          <li><a data-open="tasks" href="#">Check Tasks</a></li>
          <li><a data-open="settings" href="#">Tweak Settings</a></li>
        </ul>
      `,
      'glow://release-notes': `
        <h2>Release Notes</h2>
        <p>Version 1.0 — the dream desktop is alive.</p>
        <ul>
          <li>Draggy icons and floaty windows</li>
          <li>Spotlight-style quick launcher</li>
          <li>Markdown notes and playful vibes</li>
        </ul>
      `,
      'glow://today': `
        <h2>Today @ ${new Date().toLocaleDateString()}</h2>
        <p>${state.tasks.items.filter((t) => t.status !== 'done').length} tasks to tackle.</p>
        <p>Remember to take breaks and hydrate!</p>
      `
    };
    const html = PAGES[url] || `<h2>Hmm...</h2><p>No renderer for <strong>${escapeHtml(url)}</strong> yet.</p>`;
    return html.replace(/data-open="(.*?)"/g, 'data-open="$1"');
  }

  function handleCommand(input) {
    if (!input) return '';
    const [command, ...rest] = input.split(' ');
    const arg = rest.join(' ');

    switch (command) {
      case 'help':
        return [
          'Available commands:',
          '  help - show this message',
          '  ls - list applications',
          '  open <App> - open an application',
          '  theme - toggle theme',
          '  clear - clear log',
          '  about - about GlowOS'
        ];
      case 'ls':
        return Object.values(apps).map((app) => `- ${app.name}`);
      case 'open': {
        const match = findAppByName(arg);
        if (match) {
          openWindow(match.id);
          return `Opening ${match.name}...`;
        }
        return 'App not found';
      }
      case 'theme':
        state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
        applyTheme();
        saveState();
        return `Theme set to ${state.settings.theme}`;
      case 'clear':
        state.terminal.log = ['-- log cleared --'];
        saveState();
        return '';
      case 'about':
        return 'GlowOS — a playful desk for your imagination. ✨';
      default:
        return `Command not understood: ${command}`;
    }
  }

  function findAppByName(name = '') {
    const lower = name.trim().toLowerCase();
    return Object.values(apps).find((app) => app.name.toLowerCase() === lower || app.id === lower);
  }

  function buildDock() {
    dock.innerHTML = '';
    Object.values(apps).forEach((app) => {
      const button = document.createElement('button');
      button.className = 'dock-item';
      button.textContent = app.glyph;
      button.title = app.name;
      button.addEventListener('click', () => {
        const win = windowLayer.querySelector(`.window[data-app="${app.id}"]`);
        if (win) {
          if (win.dataset.minimized === 'true') {
            restoreWindow(win);
          }
          focusWindow(win);
        } else {
          openWindow(app.id);
        }
      });
      dock.appendChild(button);
    });
  }

  function setSelectedIcon(appId) {
    selectedDesktopIcon = appId;
    updateIconHighlights();
  }

  function updateIconHighlights() {
    if (!iconLayer) return;
    const icons = iconLayer.querySelectorAll('.desktop-icon');
    icons.forEach((icon) => {
      icon.classList.toggle('selected', !!selectedDesktopIcon && icon.dataset.app === selectedDesktopIcon);
    });
  }

  function layoutIcons() {
    const padding = 32;
    const gap = 110;
    const maxHeight = iconLayer.clientHeight - padding;
    let x = padding;
    let y = padding;
    Object.values(apps).forEach((app, index) => {
      if (!state.desktop.icons[app.id]) {
        state.desktop.icons[app.id] = { x, y };
        y += gap;
        if (y + gap > maxHeight) {
          y = padding;
          x += 110;
        }
      }
    });
  }

  function renderIcons() {
    iconLayer.innerHTML = '';
    Object.values(apps).forEach((app) => {
      const icon = document.createElement('div');
      icon.className = 'desktop-icon';
      icon.dataset.app = app.id;
      icon.innerHTML = `<span class="glyph">${app.glyph}</span><span>${app.name}</span>`;
      const coords = state.desktop.icons[app.id] || { x: 40, y: 40 };
      icon.style.left = `${coords.x}px`;
      icon.style.top = `${coords.y}px`;
      icon.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelectedIcon(app.id);
      });
      icon.addEventListener('dblclick', () => {
        openWindow(app.id);
        soundEngine.play(520, 0.12);
      });
      enableIconDrag(icon);
      iconLayer.appendChild(icon);
    });
    updateIconHighlights();
  }

  function enableIconDrag(icon) {
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    icon.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        setSelectedIcon(icon.dataset.app);
      } else {
        return;
      }
      startX = event.clientX;
      startY = event.clientY;
      const coords = state.desktop.icons[icon.dataset.app];
      initialX = coords.x;
      initialY = coords.y;
      icon.classList.add('dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    function onMove(event) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const nextX = clamp(initialX + dx, 16, iconLayer.clientWidth - 100);
      const nextY = clamp(initialY + dy, 16, iconLayer.clientHeight - 120);
      icon.style.left = `${nextX}px`;
      icon.style.top = `${nextY}px`;
    }

    function onUp(event) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const coords = state.desktop.icons[icon.dataset.app];
      coords.x = clamp(initialX + dx, 16, iconLayer.clientWidth - 100);
      coords.y = clamp(initialY + dy, 16, iconLayer.clientHeight - 120);
      icon.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveState();
    }
  }

  function buildDesktopMenuOptions(targetAppId) {
    const baseOptions = [
      {
        label: 'New Note',
        glyph: '📝',
        action: () => openWindow('notes')
      },
      {
        label: 'New Task',
        glyph: '✅',
        action: () => openWindow('tasks')
      },
      {
        label: 'Open Terminal',
        glyph: '⌨️',
        action: () => openWindow('terminal')
      },
      { separator: true },
      {
        label: state.settings.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
        glyph: '🌗',
        action: () => {
          state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light';
          applyTheme();
          saveState();
        }
      },
      {
        label: state.settings.sound ? 'Mute Sounds' : 'Enable Sounds',
        glyph: state.settings.sound ? '🔇' : '🔊',
        action: () => {
          state.settings.sound = !state.settings.sound;
          saveState();
        }
      },
      {
        label: 'Change Wallpaper…',
        glyph: '🖼️',
        action: () => openWindow('settings')
      },
      {
        label: 'About GlowOS',
        glyph: '✨',
        action: () => openWindow('browser')
      }
    ];

    if (targetAppId && apps[targetAppId]) {
      const app = apps[targetAppId];
      return [
        {
          label: `Open ${app.name}`,
          glyph: app.glyph,
          action: () => openWindow(app.id)
        },
        {
          label: 'Reset Icon Position',
          glyph: '📍',
          action: () => {
            delete state.desktop.icons[app.id];
            layoutIcons();
            renderIcons();
            saveState();
            setSelectedIcon(app.id);
          }
        },
        { separator: true },
        ...baseOptions
      ];
    }

    return baseOptions;
  }

  function hideDesktopMenu() {
    if (!desktopMenu) return;
    desktopMenu.classList.add('hidden');
    desktopMenu.classList.remove('empty');
    if (desktopMenuList) {
      desktopMenuList.innerHTML = '';
    }
  }

  function showDesktopMenu(x, y, options = []) {
    if (!desktopMenu || !desktopMenuList) return;
    desktopMenuList.innerHTML = '';
    const actionable = options.filter((option) => !option.separator);
    desktopMenu.classList.toggle('empty', actionable.length === 0);

    options.forEach((option) => {
      if (option.separator) {
        const separatorItem = document.createElement('li');
        separatorItem.innerHTML = '<hr />';
        desktopMenuList.appendChild(separatorItem);
        return;
      }
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const glyphSpan = option.glyph ? `<span class="glyph">${option.glyph}</span>` : '';
      const label = `<span class="menu-label">${glyphSpan}<span>${option.label}</span></span>`;
      const kbd = option.kbd ? `<kbd>${option.kbd}</kbd>` : '';
      button.innerHTML = `${label}${kbd}`;
      button.addEventListener('click', () => {
        hideDesktopMenu();
        option.action?.();
        if (option.sound !== false) {
          soundEngine.play(560, 0.08);
        }
      });
      item.appendChild(button);
      desktopMenuList.appendChild(item);
    });

    desktopMenu.classList.remove('hidden');
    desktopMenu.style.left = '-9999px';
    desktopMenu.style.top = '-9999px';

    requestAnimationFrame(() => {
      const rect = desktopMenu.getBoundingClientRect();
      const menuHeightRaw = getComputedStyle(document.documentElement).getPropertyValue('--menu-height');
      const menuHeight = parseInt(menuHeightRaw, 10) || 40;
      const left = clamp(x, 10, Math.max(10, window.innerWidth - rect.width - 10));
      const top = clamp(y, menuHeight + 6, Math.max(menuHeight + 6, window.innerHeight - rect.height - 10));
      desktopMenu.style.left = `${left}px`;
      desktopMenu.style.top = `${top}px`;
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function openWindow(appId, afterRender) {
    const config = apps[appId];
    if (!config) return;
    let windowEl = windowLayer.querySelector(`.window[data-app="${appId}"]`);
    if (windowEl) {
      if (windowEl.dataset.minimized === 'true') restoreWindow(windowEl);
      focusWindow(windowEl);
      if (afterRender) afterRender(windowEl);
      return windowEl;
    }

    const template = document.getElementById('window-template');
    windowEl = template.content.firstElementChild.cloneNode(true);
    const contentEl = windowEl.querySelector('.window-content');
    windowEl.dataset.app = appId;
    windowEl.style.width = `${config.width || 480}px`;
    windowEl.style.height = `${config.height || 360}px`;
    const position = state.windows[appId]
      ? { ...state.windows[appId] }
      : { x: 120 + Math.random() * 120, y: 80 + Math.random() * 60, width: config.width, height: config.height, minimized: false };
    windowEl.style.left = `${position.x}px`;
    windowEl.style.top = `${position.y}px`;
    if (position.width) windowEl.style.width = `${position.width}px`;
    if (position.height) windowEl.style.height = `${position.height}px`;
    windowEl.dataset.minimized = position.minimized ? 'true' : 'false';
    windowEl.querySelector('.window-title').textContent = config.name;

    config.render(contentEl, windowEl);

    windowLayer.appendChild(windowEl);
    bindWindowEvents(windowEl);
    focusWindow(windowEl);

    const meta = state.windows[appId] || {};
    state.windows[appId] = {
      ...meta,
      x: parseInt(windowEl.style.left, 10),
      y: parseInt(windowEl.style.top, 10),
      width: parseInt(windowEl.style.width, 10),
      height: parseInt(windowEl.style.height, 10),
      minimized: false
    };
    saveState();
    if (afterRender) afterRender(windowEl);
    return windowEl;
  }

  function bindWindowEvents(windowEl) {
    const header = windowEl.querySelector('.window-chrome');
    const closeBtn = windowEl.querySelector('.close');
    const minimizeBtn = windowEl.querySelector('.minimize');
    const resizeHandle = windowEl.querySelector('.window-resize-handle');
    const floatBtn = windowEl.querySelector('.float');
    const appId = windowEl.dataset.app;

    header.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const rect = windowEl.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;
      focusWindow(windowEl);
      function onMove(e) {
        windowEl.style.left = `${clamp(e.clientX - offsetX, 0, windowLayer.clientWidth - rect.width)}px`;
        windowEl.style.top = `${clamp(e.clientY - offsetY, 0, windowLayer.clientHeight - rect.height)}px`;
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        persistWindow(windowEl);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    windowEl.addEventListener('mousedown', () => focusWindow(windowEl));

    closeBtn.addEventListener('click', () => {
      windowEl.remove();
      delete state.windows[appId];
      saveState();
      activeAppDisplay.textContent = 'Ready';
    });

    minimizeBtn.addEventListener('click', () => {
      minimizeWindow(windowEl);
      persistWindow(windowEl);
    });

    floatBtn.addEventListener('click', () => {
      const rect = windowLayer.getBoundingClientRect();
      windowEl.style.left = `${rect.width / 2 - windowEl.offsetWidth / 2}px`;
      windowEl.style.top = `${rect.height / 2 - windowEl.offsetHeight / 2}px`;
      persistWindow(windowEl);
    });

    resizeHandle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = windowEl.offsetWidth;
      const startHeight = windowEl.offsetHeight;
      function onMove(e) {
        const width = clamp(startWidth + (e.clientX - startX), 280, windowLayer.clientWidth - 40);
        const height = clamp(startHeight + (e.clientY - startY), 200, windowLayer.clientHeight - 40);
        windowEl.style.width = `${width}px`;
        windowEl.style.height = `${height}px`;
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        persistWindow(windowEl);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function persistWindow(windowEl) {
    const appId = windowEl.dataset.app;
    state.windows[appId] = {
      x: parseInt(windowEl.style.left, 10),
      y: parseInt(windowEl.style.top, 10),
      width: parseInt(windowEl.style.width, 10),
      height: parseInt(windowEl.style.height, 10),
      minimized: windowEl.dataset.minimized === 'true'
    };
    saveState();
  }

  function minimizeWindow(windowEl) {
    windowEl.dataset.minimized = 'true';
    windowEl.style.display = 'none';
  }

  function restoreWindow(windowEl) {
    windowEl.dataset.minimized = 'false';
    windowEl.style.display = '';
    focusWindow(windowEl);
  }

  function focusWindow(windowEl) {
    zTracker += 1;
    windowEl.style.zIndex = zTracker;
    document.querySelectorAll('.window').forEach((win) => win.classList.remove('window-focused'));
    windowEl.classList.add('window-focused');
    const app = apps[windowEl.dataset.app];
    activeAppDisplay.textContent = app ? app.name : 'Ready';
  }

  function restoreWindows() {
    Object.entries(state.windows).forEach(([appId, meta]) => {
      const win = openWindow(appId);
      if (win) {
        win.style.left = `${meta.x}px`;
        win.style.top = `${meta.y}px`;
        if (meta.width) win.style.width = `${meta.width}px`;
        if (meta.height) win.style.height = `${meta.height}px`;
        if (meta.minimized) {
          minimizeWindow(win);
          if (state.windows[appId]) state.windows[appId].minimized = true;
        }
      }
    });
    saveState();
  }

  function initClock() {
    function tick() {
      const now = new Date();
      document.getElementById('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 1000 * 60);
  }

  function setupLauncher() {
    launcherInput.addEventListener('input', (e) => renderLauncherResults(e.target.value));

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggleLauncher();
      } else if (!launcher.classList.contains('hidden')) {
        const selected = launcherResults.querySelector('.launcher-item.selected');
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const next = selected?.nextElementSibling || launcherResults.firstElementChild;
          if (selected) selected.classList.remove('selected');
          next?.classList.add('selected');
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          const prev = selected?.previousElementSibling || launcherResults.lastElementChild;
          if (selected) selected.classList.remove('selected');
          prev?.classList.add('selected');
        } else if (event.key === 'Enter' && selected) {
          event.preventDefault();
          activateLauncherItem(selected.dataset.type, selected.dataset.id);
        } else if (event.key === 'Escape') {
          hideLauncher();
        }
      }
    });

    launcher.addEventListener('click', (event) => {
      if (event.target === launcher) hideLauncher();
    });

    renderLauncherResults('');
  }

  function renderLauncherResults(query = '') {
    const search = query.toLowerCase();
    const items = [
      ...Object.values(apps).map((app) => ({ type: 'app', id: app.id, label: app.name, glyph: app.glyph })),
      ...quickActions.map((action) => ({ type: 'action', id: action.id, label: action.label, glyph: '✨' }))
    ].filter((item) => item.label.toLowerCase().includes(search));

    launcherResults.innerHTML = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'launcher-item';
      li.innerHTML = '<span>Nothing found</span>';
      launcherResults.appendChild(li);
      return;
    }
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'launcher-item' + (index === 0 ? ' selected' : '');
      li.dataset.id = item.id;
      li.dataset.type = item.type;
      li.innerHTML = `<span>${item.glyph} ${item.label}</span><span>${item.type === 'app' ? '↵' : '⇧↵'}</span>`;
      li.addEventListener('click', () => activateLauncherItem(item.type, item.id));
      launcherResults.appendChild(li);
    });
  }

  function activateLauncherItem(type, id) {
    if (type === 'app') {
      openWindow(id);
    } else {
      const action = quickActions.find((item) => item.id === id);
      action?.handler();
    }
    hideLauncher();
  }

  function toggleLauncher() {
    const hidden = launcher.classList.toggle('hidden');
    if (!hidden) {
      hideDesktopMenu();
      launcherInput.value = '';
      launcher.classList.add('fade-in');
      setTimeout(() => launcher.classList.remove('fade-in'), 300);
      launcherInput.focus();
      renderLauncherResults('');
    }
  }

  function hideLauncher() {
    launcher.classList.add('hidden');
  }

  function initMenuButtons() {
    document.querySelectorAll('.menu-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const menu = button.dataset.menu;
        if (menu === 'file') {
          openWindow('files');
        } else if (menu === 'edit') {
          openWindow('notes');
        } else if (menu === 'view') {
          openWindow('settings');
        } else if (menu === 'go') {
          openWindow('browser');
        } else if (menu === 'help') {
          openWindow('terminal');
        }
      });
    });
  }

  function initTopBar() {
    initClock();
    initMenuButtons();
  }

  function attachGlobalEvents() {
    window.addEventListener('resize', () => {
      layoutIcons();
      renderIcons();
      hideDesktopMenu();
    });

    windowLayer.addEventListener('click', (event) => {
      const link = event.target.closest('.browser-view a[data-open]');
      if (!link) return;
      event.preventDefault();
      const appId = link.dataset.open;
      openWindow(appId);
    });

    if (desktop) {
      desktop.addEventListener('contextmenu', (event) => {
        if (event.target.closest('.window')) return;
        event.preventDefault();
        hideDesktopMenu();
        const icon = event.target.closest('.desktop-icon');
        if (icon) {
          setSelectedIcon(icon.dataset.app);
        } else if (event.target === desktop || event.target === wallpaperOverlay) {
          setSelectedIcon(null);
        }
        const options = buildDesktopMenuOptions(icon?.dataset.app);
        showDesktopMenu(event.clientX, event.clientY, options);
      });

      desktop.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        if (event.target === desktop || event.target === wallpaperOverlay) {
          setSelectedIcon(null);
          hideDesktopMenu();
        }
      });
    }

    if (dock) {
      dock.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        hideDesktopMenu();
        setSelectedIcon(null);
        const options = buildDesktopMenuOptions();
        showDesktopMenu(event.clientX, event.clientY, options);
      });
    }

    if (desktopMenu) {
      desktopMenu.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }

    window.addEventListener('mousedown', (event) => {
      if (!desktopMenu || desktopMenu.classList.contains('hidden')) return;
      if (!desktopMenu.contains(event.target)) {
        hideDesktopMenu();
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideDesktopMenu();
      }
    });

    window.addEventListener('scroll', hideDesktopMenu, true);
  }

  function restoreBrowser() {
    if (!state.browser.history.length) {
      state.browser.history = ['about:home'];
      state.browser.index = 0;
    }
    if (state.browser.index >= state.browser.history.length) {
      state.browser.index = state.browser.history.length - 1;
    }
    if (state.browser.index < 0) {
      state.browser.index = 0;
    }
  }

  function bootstrap() {
    applyTheme();
    applyWallpaper();
    layoutIcons();
    renderIcons();
    buildDock();
    restoreBrowser();
    restoreWindows();
    initTopBar();
    attachGlobalEvents();
    setupLauncher();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
