(() => {
  'use strict';

  const PAGE_SIZE = 24;
  const LANGUAGE_COLORS = {
    Python: '#3776ab', TypeScript: '#3178c6', JavaScript: '#f1e05a', Rust: '#dea584',
    Go: '#00add8', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Java: '#b07219',
    Jupyter: '#da5b0b', 'Jupyter Notebook': '#da5b0b', R: '#198ce7', Shell: '#89e051',
    Ruby: '#701516', Swift: '#f05138', Kotlin: '#a97bff', HTML: '#e34c26', CSS: '#563d7c',
    Lua: '#000080', Scala: '#c22d40', Dart: '#00b4ab', PHP: '#4f5d95', Vue: '#41b883',
    TeX: '#3d6117', Zig: '#ec915c', OCaml: '#ef7a08', Elixir: '#6e4a7e'
  };
  const $ = (id) => document.getElementById(id);
  const state = { data: [], username: 'Lcollection', query: '', language: '', topic: '', sort: 'newest', visible: PAGE_SIZE, languagesExpanded: false };
  const formatNumber = (n) => new Intl.NumberFormat('zh-CN').format(n);
  const normalize = (v) => String(v || '').normalize('NFKC').toLocaleLowerCase();
  const languageColor = (language) => LANGUAGE_COLORS[language] || '#9c92bf';
  const dateLabel = (iso) => {
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return '未知日期';
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date);
  };
  const make = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined && content !== null) node.textContent = content;
    return node;
  };
  const validName = (name) => /^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(name);
  const safeRepoUrl = (repo) => {
    // Never use arbitrary external addresses from JSON as navigable hrefs.
    return validName(repo.full_name) ? `https://github.com/${repo.full_name}` : 'https://github.com';
  };
  const countBy = (values) => {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const setVisibility = (id, visible) => { $(id).hidden = !visible; };

  function readLocation() {
    const params = new URLSearchParams(location.search);
    state.query = (params.get('q') || '').slice(0, 200);
    state.language = (params.get('lang') || '').slice(0, 100);
    state.topic = (params.get('topic') || '').slice(0, 100);
    state.sort = ['newest', 'oldest', 'name', 'name-desc'].includes(params.get('sort')) ? params.get('sort') : 'newest';
    $('search').value = state.query;
    $('sort').value = state.sort;
  }

  function writeLocation() {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.language) params.set('lang', state.language);
    if (state.topic) params.set('topic', state.topic);
    if (state.sort !== 'newest') params.set('sort', state.sort);
    const query = params.toString();
    history.replaceState(null, '', location.pathname + (query ? '?' + query : '') + location.hash);
  }

  function updateSummary() {
    const languages = countBy(state.data.map((r) => r.language).filter(Boolean));
    const topics = countBy(state.data.flatMap((r) => r.topics));
    $('stat-total').textContent = formatNumber(state.data.length);
    $('stat-languages').textContent = formatNumber(languages.length);
    $('stat-topics').textContent = formatNumber(topics.length);
    $('stat-latest').textContent = state.data.length ? dateLabel(state.data.reduce((max, r) => r.starred_at > max ? r.starred_at : max, '')) : '—';
    $('language-total').textContent = `${languages.length} 种`;
    $('hero-owner').textContent = '@' + state.username;
    $('profile-link').href = `https://github.com/${encodeURIComponent(state.username)}`;
    document.title = `${state.username} 的 Star 收藏 · Starfield`;
    renderLanguageFilters(languages);
    renderTopicFilters(topics);
  }

  function renderLanguageFilters(languages) {
    const container = $('language-filters');
    container.replaceChildren();
    const items = [['', state.data.length], ...languages];
    const display = state.languagesExpanded ? items : items.slice(0, 9);
    // Always keep an active language visible, even if it is below the default fold.
    if (!state.languagesExpanded && state.language && !display.some(([name]) => name === state.language)) {
      const selected = items.find(([name]) => name === state.language);
      if (selected) display.push(selected);
    }
    for (const [name, count] of display) {
      const button = make('button', 'language-option');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(state.language === name));
      button.title = name || '全部语言';
      const dot = make('span', 'language-dot');
      dot.style.setProperty('--dot-color', name ? languageColor(name) : '#e8b181');
      button.append(dot, make('span', 'language-name', name || '全部语言'), make('span', 'language-count', formatNumber(count)));
      button.addEventListener('click', () => { state.language = name; state.visible = PAGE_SIZE; sync(); });
      container.append(button);
    }
    const more = $('more-languages');
    more.hidden = items.length <= 9;
    more.textContent = state.languagesExpanded ? '收起语言 ↑' : '显示更多语言 ↓';
  }

  function renderTopicFilters(topics) {
    const container = $('topic-filters');
    container.replaceChildren();
    if (!topics.length) { container.append(make('span', 'filter-hint', '暂无 Topics')); return; }
    const shown = topics.slice(0, 18);
    if (state.topic && !shown.some(([name]) => name === state.topic)) {
      const extra = topics.find(([name]) => name === state.topic);
      if (extra) shown.push(extra);
    }
    for (const [name] of shown) {
      const button = make('button', 'topic-option', '#' + name);
      button.type = 'button';
      button.title = `筛选 Topic：${name}`;
      button.setAttribute('aria-pressed', String(state.topic === name));
      button.addEventListener('click', () => { state.topic = state.topic === name ? '' : name; state.visible = PAGE_SIZE; sync(); });
      container.append(button);
    }
  }

  function selectedRepos() {
    const query = normalize(state.query.trim());
    const repos = state.data.filter((repo) => {
      if (state.language && repo.language !== state.language) return false;
      if (state.topic && !repo.topics.includes(state.topic)) return false;
      if (!query) return true;
      return [repo.full_name, repo.description, repo.language, ...repo.topics].some((s) => normalize(s).includes(query));
    });
    repos.sort((a, b) => {
      if (state.sort === 'oldest') return a.starred_at.localeCompare(b.starred_at) || a.full_name.localeCompare(b.full_name);
      if (state.sort === 'name') return a.full_name.localeCompare(b.full_name);
      if (state.sort === 'name-desc') return b.full_name.localeCompare(a.full_name);
      return b.starred_at.localeCompare(a.starred_at) || a.full_name.localeCompare(b.full_name);
    });
    return repos;
  }

  function renderCard(repo) {
    const card = make('article', 'repo-card');
    const head = make('div', 'repo-card-head');
    const title = make('div', 'repo-name');
    const parts = repo.full_name.split('/');
    const link = make('a');
    link.href = safeRepoUrl(repo); link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.append(make('span', 'repo-owner', (parts[0] || '') + ' / '), make('span', '', parts[1] || repo.full_name));
    title.append(link);
    const nameGroup = make('div');
    const titleRow = make('div');
    titleRow.style.display = 'flex'; titleRow.style.gap = '10px';
    titleRow.append(make('span', 'repo-symbol', '✳'), title);
    nameGroup.append(titleRow);
    const external = make('a', 'repo-external', '↗');
    external.href = safeRepoUrl(repo); external.target = '_blank'; external.rel = 'noopener noreferrer';
    external.setAttribute('aria-label', `在 GitHub 打开 ${repo.full_name}`);
    head.append(nameGroup, external);
    card.append(head, make('p', 'repo-description', repo.description || '该仓库暂无简介。'));
    const tags = make('div', 'repo-tags');
    for (const topic of repo.topics.slice(0, 4)) {
      const button = make('button', 'repo-tag button-tag', '#' + topic);
      button.type = 'button'; button.title = `筛选 Topic：${topic}`;
      button.addEventListener('click', () => { state.topic = topic; state.visible = PAGE_SIZE; sync(); $('catalog-title').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      tags.append(button);
    }
    if (repo.archived) tags.append(make('span', 'repo-tag', 'Archived'));
    if (repo.fork) tags.append(make('span', 'repo-tag', 'Fork'));
    card.append(tags);
    const bottom = make('div', 'repo-bottom');
    const language = make('div', 'repo-language');
    const dot = make('span', 'language-dot');
    dot.style.setProperty('--dot-color', languageColor(repo.language));
    language.append(dot, make('span', 'repo-language-label', repo.language || '未指定语言'));
    const starred = make('span', 'repo-date', '✦ ' + dateLabel(repo.starred_at));
    starred.title = '收藏日期（UTC）';
    bottom.append(language, starred);
    card.append(bottom);
    return card;
  }

  function renderActiveFilters() {
    const wrapper = $('active-filters'); wrapper.replaceChildren();
    const active = [
      state.query && ['搜索: ' + state.query, 'query'],
      state.language && ['语言: ' + state.language, 'language'],
      state.topic && ['Topic: ' + state.topic, 'topic'],
    ].filter(Boolean);
    wrapper.hidden = !active.length;
    $('active-indicator').textContent = active.length ? '· 已筛选' : '';
    for (const [label, key] of active) {
      const button = make('button', 'active-chip', label + ' ×');
      button.type = 'button'; button.setAttribute('aria-label', `清除${label}`);
      button.addEventListener('click', () => { state[key] = ''; state.visible = PAGE_SIZE; sync(); });
      wrapper.append(button);
    }
  }

  function renderResults() {
    const repos = selectedRepos();
    const grid = $('repo-grid'); grid.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const repo of repos.slice(0, state.visible)) fragment.append(renderCard(repo));
    grid.append(fragment);
    $('result-count').textContent = formatNumber(repos.length);
    setVisibility('repo-grid', repos.length > 0);
    setVisibility('empty-state', repos.length === 0);
    setVisibility('load-more', repos.length > state.visible);
    $('shown-count').textContent = repos.length ? `已显示 ${formatNumber(Math.min(state.visible, repos.length))} / ${formatNumber(repos.length)} 个项目` : '';
    renderActiveFilters();
    renderLanguageFilters(countBy(state.data.map((r) => r.language).filter(Boolean)));
    renderTopicFilters(countBy(state.data.flatMap((r) => r.topics)));
  }

  function sync() {
    $('search').value = state.query;
    $('sort').value = state.sort;
    writeLocation(); renderResults();
  }

  function clearFilters() {
    state.query = ''; state.language = ''; state.topic = ''; state.sort = 'newest'; state.visible = PAGE_SIZE;
    sync();
  }

  function validateData(payload) {
    if (!payload || !Array.isArray(payload.repositories) || !/^[a-z\d-]{1,39}$/i.test(payload.username || '')) {
      throw new Error('stars.json 格式无效');
    }
    const valid = [];
    for (const row of payload.repositories) {
      if (!row || !validName(row.full_name) || typeof row.starred_at !== 'string') continue;
      valid.push({
        full_name: row.full_name, description: typeof row.description === 'string' ? row.description : '',
        language: typeof row.language === 'string' ? row.language : '',
        topics: Array.isArray(row.topics) ? row.topics.filter((t) => typeof t === 'string').slice(0, 100) : [],
        starred_at: row.starred_at, archived: !!row.archived, fork: !!row.fork
      });
    }
    return { username: payload.username, repositories: valid };
  }

  async function load() {
    setVisibility('loading-state', true);
    setVisibility('error-state', false);
    setVisibility('empty-state', false);
    setVisibility('repo-grid', false);
    try {
      const response = await fetch('./stars.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = validateData(await response.json());
      state.data = payload.repositories; state.username = payload.username;
      updateSummary();
      setVisibility('loading-state', false);
      renderResults();
    } catch (error) {
      setVisibility('loading-state', false);
      setVisibility('error-state', true);
      $('error-description').textContent = `收藏快照加载失败（${error.message}）。请先运行同步工作流，或检查 stars.json。`;
    }
  }

  function initTheme() {
    let stored;
    try { stored = localStorage.getItem('starfield-theme'); } catch (_) { /* storage disabled */ }
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.dataset.theme = theme;
    $('theme-toggle').textContent = theme === 'dark' ? '☼' : '☾';
  }
  function toggleTheme() {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    $('theme-toggle').textContent = theme === 'dark' ? '☼' : '☾';
    try { localStorage.setItem('starfield-theme', theme); } catch (_) { /* storage disabled */ }
  }

  function bindEvents() {
    $('search').addEventListener('input', (event) => { state.query = event.target.value; state.visible = PAGE_SIZE; sync(); });
    $('sort').addEventListener('change', (event) => { state.sort = event.target.value; state.visible = PAGE_SIZE; sync(); });
    $('reset-filters').addEventListener('click', clearFilters);
    $('empty-reset').addEventListener('click', clearFilters);
    $('retry-load').addEventListener('click', load);
    $('load-more').addEventListener('click', () => { state.visible += PAGE_SIZE; renderResults(); });
    $('more-languages').addEventListener('click', () => { state.languagesExpanded = !state.languagesExpanded; renderResults(); });
    $('theme-toggle').addEventListener('click', toggleTheme);
    document.addEventListener('keydown', (event) => {
      const target = event.target;
      if (event.key === '/' && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLSelectElement)) {
        event.preventDefault(); $('search').focus();
      }
      if (event.key === 'Escape' && document.activeElement === $('search')) $('search').blur();
    });
    window.addEventListener('popstate', () => { readLocation(); state.visible = PAGE_SIZE; renderResults(); });
  }

  readLocation(); initTheme(); bindEvents(); load();
})();
