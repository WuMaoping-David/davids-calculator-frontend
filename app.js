'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const apiBaseUrl = (window.CALCULATOR_CONFIG?.apiBaseUrl || 'http://localhost:8080').replace(/\/+$/, '');
  const configuredTimeout = window.CALCULATOR_CONFIG?.requestTimeoutMs;
  const requestTimeout = Number.isInteger(configuredTimeout)
      && configuredTimeout >= 1000 && configuredTimeout <= 120000 ? configuredTimeout : 10000;
  const expressionInput = $('#expression');
  const historyList = $('#history-list');
  const historyEmpty = $('#history-empty');
  const historyMessage = $('#history-message');
  const refreshButton = $('#refresh-history');
  const modeNames = {calculation: 'Scientific'};
  const clearButton = $('#clear-history');
  const views = {
    calculation: {input: expressionInput, output: $('#result'), status: $('#calculation-state'), message: $('#calculation-message'), button: $('#calculate-button'), version: 0, pending: false},
  };
  const state = {mode: 'calculation', angleMode: 'deg', historyRequestVersion: 0, history: [], deletingIds: new Set(), clearing: false};

  class ApiError extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
    }
  }

  function setConnection(online) {
    $('#connection-status').dataset.state = online ? 'online' : 'offline';
    $('#connection-text').textContent = online ? 'Connected' : 'Offline';
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeout);
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options, signal: controller.signal, cache: 'no-store',
        headers: {Accept: 'application/json', ...options.headers},
      });
      let body;
      try {
        body = await response.json();
      } catch {
        throw new ApiError('The service returned an unreadable response. Please try again.', 'INVALID_RESPONSE');
      }
      setConnection(true);
      if (!body || typeof body !== 'object') {
        throw new ApiError('The service returned an unexpected response.', 'INVALID_RESPONSE');
      }
      if (!response.ok || body.success !== true) {
        throw new ApiError(typeof body.message === 'string' ? body.message : 'The request could not be completed. Please try again.', body.code);
      }
      return body.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      setConnection(false);
      if (error.name === 'AbortError') {
        throw new ApiError('The request timed out. Refresh history to check whether the result was saved before trying again.', 'TIMEOUT');
      }
      throw new ApiError('Cannot reach the calculation service. Check that the server is running, then try again.', 'NETWORK_ERROR');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function hideMessage(mode) {
    const view = views[mode];
    view.message.hidden = true;
    view.message.textContent = '';
    view.input.removeAttribute('aria-invalid');
  }

  function showError(mode, message) {
    const view = views[mode];
    view.message.textContent = message;
    view.message.hidden = false;
    view.input.setAttribute('aria-invalid', 'true');
    view.status.textContent = 'Please check and retry';
  }

  function markEdited(mode) {
    const view = views[mode];
    view.version += 1;
    hideMessage(mode);
    view.output.textContent = '—';
    view.output.classList.remove('has-result', 'long-result');
    view.status.textContent = view.pending ? 'Input changed; run again' : 'Ready when you are';
  }

  function setAngle(mode) {
    state.angleMode = mode === 'rad' ? 'rad' : 'deg';
    for (const button of document.querySelectorAll('[data-angle]')) {
      button.setAttribute('aria-pressed', String(button.dataset.angle === state.angleMode));
    }
  }

  function setExpression(value) {
    expressionInput.value = value.slice(0, expressionInput.maxLength);
    expressionInput.focus({preventScroll: true});
    expressionInput.setSelectionRange(expressionInput.value.length, expressionInput.value.length);
    markEdited('calculation');
  }

  function insertAtCaret(value) {
    const start = expressionInput.selectionStart;
    const end = expressionInput.selectionEnd;
    if (expressionInput.value.length - (end - start) + value.length > expressionInput.maxLength) {
      showError('calculation', `Expressions can contain up to ${expressionInput.maxLength} characters.`);
      return;
    }
    expressionInput.setRangeText(value, start, end, 'end');
    expressionInput.focus({preventScroll: true});
    markEdited('calculation');
  }

  function backspaceAtCaret() {
    const start = expressionInput.selectionStart;
    const end = expressionInput.selectionEnd;
    if (start !== end || start > 0) {
      expressionInput.setRangeText('', start === end ? start - 1 : start, end, 'end');
      markEdited('calculation');
    }
    expressionInput.focus({preventScroll: true});
  }

  function normalizeExpression(expression) {
    return expression.trim().replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  }

  function displayExpression(expression) {
    return expression.replace(/\b(asin|acos|atan)\s*\(/gi, (name) => ({asin: 'arcsin(', acos: 'arccos(', atan: 'arctan('})[name.trim().slice(0, -1).trim().toLowerCase()]).replace(/\*/g, '×').replace(/\//g, '÷');
  }

  function isRecord(record) {
    return record && Number.isSafeInteger(record.id) && record.id > 0 &&
      typeof record.expression === 'string' && typeof record.result === 'string' &&
      typeof record.createdAt === 'string';
  }

  async function submit(mode) {
    const view = views[mode];
    if (view.pending || state.clearing) return;
    hideMessage(mode);
    const path = '/api/calculate';
    const parameters = {expression: normalizeExpression(expressionInput.value), angleMode: state.angleMode};
    if (!(parameters.expression ?? parameters.value)) {
      showError(mode, 'Enter an expression to calculate.');
      view.input.focus({preventScroll: true});
      return;
    }
    const requestedVersion = view.version;
    view.pending = true;
    updateClearButton();
    view.button.disabled = true;
    view.input.setAttribute('aria-busy', 'true');
    view.status.textContent = 'Calculating…';
    try {
      const record = await request(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(parameters)});
      if (!isRecord(record)) throw new ApiError('The result format was unexpected. Refresh history before trying again.', 'INVALID_RESPONSE');
      // Each mode has its own revision, so a late reply can never answer an
      // edited input or appear in the currently visible, unrelated mode.
      if (requestedVersion === view.version) {
        view.output.textContent = record.result;
        view.output.classList.add('has-result');
        view.output.classList.toggle('long-result', record.result.length > 17);
        view.status.textContent = 'Saved to history';
      }
      await loadHistory();
    } catch (error) {
      if (requestedVersion === view.version) {
        view.output.textContent = '—';
        view.output.classList.remove('has-result', 'long-result');
        showError(mode, error.message);
      }
    } finally {
      view.pending = false;
      updateClearButton();
      view.button.disabled = false;
      view.input.setAttribute('aria-busy', 'false');
      if (requestedVersion !== view.version) view.status.textContent = 'Ready when you are';
    }
  }

  function formattedTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}).format(date);
  }

  function deleteIcon() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7');
    svg.append(path);
    return svg;
  }

  function reuseRecord(record) {
    const parameters = record.parameters;
    if (record.type && record.type !== 'calculation') return;
    setAngle(parameters?.angleMode);
    setExpression(displayExpression(typeof parameters?.expression === 'string' ? parameters.expression : record.expression));
    const input = views[state.mode].input;
    input.focus({preventScroll: true});
    input.scrollIntoView({block: 'nearest', behavior: 'auto'});
  }

  function renderHistory() {
    updateClearButton();
    historyList.replaceChildren();
    $('#history-count').textContent = String(state.history.length);
    historyEmpty.hidden = state.history.length > 0;
    $('#empty-title').textContent = 'A fresh start';
    $('#empty-description').textContent = 'Your calculations will be saved here. Try your first one.';
    for (const record of state.history) {
      const type = record.type || 'calculation';
      const article = document.createElement('article');
      article.className = 'history-item';
      const badge = document.createElement('span');
      badge.className = 'history-type';
      badge.textContent = modeNames[type] || 'Archived record';
      if (type === 'calculation' && record.parameters?.angleMode) badge.textContent += ` · ${String(record.parameters.angleMode).toUpperCase()}`;
      const reuse = document.createElement('button');
      reuse.type = 'button';
      reuse.className = 'history-expression-button';
      reuse.textContent = type === 'calculation' ? displayExpression(record.expression) : record.expression;
      reuse.disabled = type !== 'calculation';
      reuse.title = reuse.disabled ? 'This feature has been removed; the saved record is preserved.' : 'Reuse this expression';
      reuse.setAttribute('aria-label', `Reuse ${modeNames[type] || 'calculation'}: ${record.expression}`);
      reuse.addEventListener('click', () => reuseRecord(record));
      const result = document.createElement('p');
      result.className = 'history-result';
      result.textContent = record.result;
      const footer = document.createElement('div');
      footer.className = 'history-item-footer';
      const time = document.createElement('time');
      time.className = 'history-time';
      time.dateTime = record.createdAt;
      time.textContent = formattedTime(record.createdAt);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'history-delete';
      remove.title = 'Delete this entry';
      remove.disabled = state.clearing || state.deletingIds.has(record.id);
      remove.setAttribute('aria-label', `Delete ${record.expression} = ${record.result}`);
      remove.append(deleteIcon());
      remove.addEventListener('click', () => deleteHistory(record.id));
      footer.append(time, remove);
      article.append(badge, reuse, result, footer);
      historyList.append(article);
    }
  }

  async function loadHistory() {
    const requestVersion = ++state.historyRequestVersion;
    refreshButton.disabled = true;
    historyList.setAttribute('aria-busy', 'true');
    historyMessage.hidden = true;
    if (state.history.length === 0) {
      historyEmpty.hidden = false;
      $('#empty-title').textContent = 'Loading history';
      $('#empty-description').textContent = 'Your saved results will appear here.';
    }
    try {
      const records = await request('/api/history');
      if (!Array.isArray(records) || !records.every(isRecord)) throw new ApiError('The history format was unexpected. Please try again.', 'INVALID_RESPONSE');
      if (requestVersion !== state.historyRequestVersion) return;
      state.history = records;
      renderHistory();
    } catch (error) {
      if (requestVersion !== state.historyRequestVersion) return;
      if (state.history.length === 0) {
        $('#empty-title').textContent = 'History is unavailable';
        $('#empty-description').textContent = 'Reconnect to the calculation service, then select Refresh history.';
      }
      historyMessage.textContent = error.message;
      historyMessage.hidden = false;
    } finally {
      if (requestVersion === state.historyRequestVersion) {
        refreshButton.disabled = false;
        historyList.setAttribute('aria-busy', 'false');
      }
    }
  }

  function updateClearButton() {
    clearButton.disabled = state.clearing || views.calculation.pending || state.deletingIds.size > 0 || state.history.length === 0;
    clearButton.textContent = state.clearing ? 'Clearing…' : 'Clear all';
  }

  async function clearHistory() {
    if (clearButton.disabled) return;
    state.clearing = true;
    // Invalidate older refreshes before deleting so they cannot restore stale rows.
    ++state.historyRequestVersion;
    views.calculation.button.disabled = true;
    renderHistory();
    historyMessage.hidden = true;
    try {
      await request('/api/history', {method: 'DELETE'});
      state.history = [];
      renderHistory();
      await loadHistory();
    } catch (error) {
      historyMessage.textContent = error.message;
      historyMessage.hidden = false;
    } finally {
      state.clearing = false;
      refreshButton.disabled = false;
      views.calculation.button.disabled = views.calculation.pending;
      renderHistory();
    }
  }

  async function deleteHistory(id) {
    if (state.clearing || state.deletingIds.has(id)) return;
    state.deletingIds.add(id);
    renderHistory();
    historyMessage.hidden = true;
    try {
      await request(`/api/history/${encodeURIComponent(id)}`, {method: 'DELETE'});
      state.history = state.history.filter((record) => record.id !== id);
      renderHistory();
      await loadHistory();
    } catch (error) {
      historyMessage.textContent = error.message;
      historyMessage.hidden = false;
    } finally {
      state.deletingIds.delete(id);
      renderHistory();
    }
  }

  for (const [mode, view] of Object.entries(views)) {
    view.input.addEventListener('input', () => markEdited(mode));
    $(`#${mode}-form`).addEventListener('submit', (event) => {
      event.preventDefault();
      submit(mode);
    });
  }
  document.querySelector('.angle-control').addEventListener('click', (event) => {
    const button = event.target.closest('[data-angle]');
    if (!button || button.dataset.angle === state.angleMode) return;
    setAngle(button.dataset.angle);
    markEdited('calculation');
  });
  $('#panel-calculation').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.key !== undefined) insertAtCaret(button.dataset.key);
    if (button.dataset.action === 'clear') setExpression('');
    if (button.dataset.action === 'backspace') backspaceAtCaret();
  });
  document.addEventListener('keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      const view = views[state.mode];
      view.input.value = '';
      view.input.focus({preventScroll: true});
      markEdited(state.mode);
      return;
    }
    if (event.target === expressionInput && (event.key === 'Enter' || event.key === '=')) {
      event.preventDefault();
      submit('calculation');
      return;
    }
    const editingControl = event.target.matches('input, textarea, select, [contenteditable="true"]');
    if (state.mode === 'calculation' && !editingControl && /^[0-9.+\-*/()^!]$/.test(event.key)) {
      event.preventDefault();
      insertAtCaret(event.key);
    }
  });
  refreshButton.addEventListener('click', loadHistory);
  clearButton.addEventListener('click', clearHistory);
  request('/api/health').catch(() => {});
  loadHistory();
})();
