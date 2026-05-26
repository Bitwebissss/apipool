/* docs.js — Miningcore API Documentation
   Pure vanilla JS, IIFE, no innerHTML with user data, no eval */

(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────── */
  const cfg = {
    baseUrl: localStorage.getItem('mc_base_url') || 'https://pool.bitwebcore.net',
    poolId:  localStorage.getItem('mc_pool_id')  || '',
    theme:   localStorage.getItem('mc_theme')    || 'auto',
  };

  /* ── THEME ──────────────────────────────────── */
  const Theme = (() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const icons = { light: 'fa-regular fa-sun', dark: 'fa-regular fa-moon', auto: 'fa-solid fa-circle-half-stroke' };
    const labels = { light: 'Light', dark: 'Dark', auto: 'Auto' };

    function apply(t) {
      const resolved = t === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : t;
      document.documentElement.setAttribute('data-bs-theme', resolved);
      const iconEl  = document.getElementById('theme-icon');
      const labelEl = document.getElementById('theme-label');
      if (iconEl)  iconEl.className = icons[t];
      if (labelEl) labelEl.textContent = labels[t];
      document.querySelectorAll('[data-theme]').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === t);
      });
    }

    function init() {
      apply(cfg.theme);
      mediaQuery.addEventListener('change', () => { if (cfg.theme === 'auto') apply('auto'); });
    }

    function set(t) {
      cfg.theme = t;
      localStorage.setItem('mc_theme', t);
      apply(t);
    }

    return { init, set };
  })();

  /* ── HELPERS ────────────────────────────────── */

  // Build URL from template + path params + query params
  function buildUrl(tpl, pathVars = {}, queryVars = {}) {
    let url = cfg.baseUrl + tpl;
    Object.entries(pathVars).forEach(([k, v]) => {
      url = url.replace('{' + k + '}', encodeURIComponent(v));
    });
    const qs = Object.entries(queryVars)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
    return qs ? url + '?' + qs : url;
  }

  // XSS-safe JSON syntax highlighter
  function highlightJson(raw) {
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(
      /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (m) => {
        let cls = 'json-num';
        if (/^"/.test(m)) {
          cls = /:$/.test(m) ? 'json-key' : 'json-str';
        } else if (/true|false/.test(m)) {
          cls = 'json-bool';
        } else if (/null/.test(m)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + m + '</span>';
      }
    );
  }

  // Safe text node setter
  function setText(el, text) { el.textContent = text; }

  // Format bytes
  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /* ── API CLIENT ─────────────────────────────── */
  async function apiRequest(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const t0 = performance.now();
    const res = await fetch(url, opts);
    const elapsed = Math.round(performance.now() - t0);
    const text = await res.text();
    return { status: res.status, ok: res.ok, text, elapsed };
  }

  /* ── ENDPOINT DEFINITIONS ───────────────────── */
  // param types: path | query | body
  // inputType: text | number | select
  const POOL_ENDPOINTS = [
    {
      group: 'Utility',
      items: [
        {
          id: 'healthCheck',
          method: 'GET',
          path: '/api/health-check',
          summary: 'Health check',
          desc: 'Returns 👍 if the pool API is up and reachable.',
          params: [],
        },
        {
          id: 'getHelp',
          method: 'GET',
          path: '/api/help',
          summary: 'Route list',
          desc: 'Returns a plain-text list of all registered API routes.',
          params: [],
        },
      ],
    },
    {
      group: 'Pool Stats',
      items: [
        {
          id: 'listPools',
          method: 'GET',
          path: '/api/pools',
          summary: 'List all pools',
          desc: 'Returns all enabled pools with configuration, network stats, payout config, top miners, and live hashrate.',
          params: [
            { name: 'topMinersRange', type: 'query', inputType: 'number', placeholder: '24', hint: 'Hours back for top miners list (default 24)' },
          ],
        },
        {
          id: 'getPool',
          method: 'GET',
          path: '/api/pools/{poolId}',
          summary: 'Pool info',
          desc: 'Same as /api/pools but returns a single pool object. Uses the currently selected Pool ID from the toolbar.',
          params: [
            { name: 'topMinersRange', type: 'query', inputType: 'number', placeholder: '24', hint: 'Hours back for top miners list' },
          ],
        },
        {
          id: 'getPoolPerformance',
          method: 'GET',
          path: '/api/pools/{poolId}/performance',
          summary: 'Pool hashrate history',
          desc: 'Historical hashrate and share rate samples for the pool, used to draw performance charts.',
          params: [
            {
              name: 'r', type: 'query', inputType: 'select', placeholder: '',
              options: [{ value: '', label: '— range —' }, { value: 'hour', label: 'Hour' }, { value: 'day', label: 'Day (default)' }, { value: 'month', label: 'Month' }],
              hint: 'Sample range',
            },
            {
              name: 'i', type: 'query', inputType: 'select', placeholder: '',
              options: [{ value: '', label: '— interval —' }, { value: 'minute', label: 'Minute' }, { value: 'hour', label: 'Hour (default)' }, { value: 'day', label: 'Day' }],
              hint: 'Sample interval',
            },
          ],
        },
        {
          id: 'listMiners',
          method: 'GET',
          path: '/api/pools/{poolId}/miners',
          summary: 'Top miners by hashrate',
          desc: 'Paginated list of miners sorted by hashrate descending within the given time range.',
          params: [
            { name: 'page',           type: 'query', inputType: 'number', placeholder: '0',  hint: 'Page number (0-indexed)' },
            { name: 'pageSize',       type: 'query', inputType: 'number', placeholder: '15', hint: 'Items per page (default 15)' },
            { name: 'topMinersRange', type: 'query', inputType: 'number', placeholder: '24', hint: 'Hours back (default 24)' },
          ],
        },
      ],
    },
    {
      group: 'Blocks',
      items: [
        {
          id: 'getBlocks',
          method: 'GET',
          path: '/api/pools/{poolId}/blocks',
          summary: 'Pool blocks',
          desc: 'Paginated list of blocks found by this pool. Filter by status: confirmed, pending, orphaned.',
          params: [
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',  hint: 'Page (0-indexed)' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15', hint: 'Default 15' },
            { name: 'state',    type: 'query', inputType: 'text',   placeholder: 'confirmed,pending', hint: 'Comma-separated statuses (optional)' },
          ],
        },
        {
          id: 'getBlocksV2',
          method: 'GET',
          path: '/api/v2/pools/{poolId}/blocks',
          summary: 'Pool blocks (v2 — paginated)',
          desc: 'Same as v1 but wraps result in { result, pageCount, itemCount } for easier pagination UI.',
          v2: true,
          params: [
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',  hint: 'Page (0-indexed)' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15', hint: 'Default 15' },
          ],
        },
        {
          id: 'getAllBlocks',
          method: 'GET',
          path: '/api/blocks',
          summary: 'All blocks (cluster-wide)',
          desc: 'Returns blocks across all pools in the cluster. Paginated.',
          params: [
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',  hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15', hint: '' },
          ],
        },
      ],
    },
    {
      group: 'Payments',
      items: [
        {
          id: 'getPayments',
          method: 'GET',
          path: '/api/pools/{poolId}/payments',
          summary: 'Pool payments',
          desc: 'Paginated list of all payments made by this pool, newest first. Each record includes address, amount, tx hash, and explorer link.',
          params: [
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',  hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15', hint: '' },
          ],
        },
        {
          id: 'getPaymentsV2',
          method: 'GET',
          path: '/api/v2/pools/{poolId}/payments',
          summary: 'Pool payments (v2 — paginated)',
          desc: 'Same as v1 with added pageCount and itemCount for pagination controls.',
          v2: true,
          params: [
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',  hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15', hint: '' },
          ],
        },
      ],
    },
  ];

  const MINER_ENDPOINTS = [
    {
      group: 'Miner Stats',
      items: [
        {
          id: 'getMinerStats',
          method: 'GET',
          path: '/api/pools/{poolId}/miners/{address}',
          summary: 'Miner overview',
          desc: 'Returns miner stats: pending balance, total paid, pending shares, effort, last payment, workers online/offline, and current performance samples.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text', placeholder: 'web1p...', hint: 'Miner wallet address', required: true },
            {
              name: 'perfMode', type: 'query', inputType: 'select', placeholder: '',
              options: [{ value: '', label: '— perf range —' }, { value: 'hour', label: 'Hour' }, { value: 'day', label: 'Day (default)' }, { value: 'month', label: 'Month' }],
              hint: 'Performance sample range',
            },
          ],
        },
        {
          id: 'getMinerPerformance',
          method: 'GET',
          path: '/api/pools/{poolId}/miners/{address}/performance',
          summary: 'Worker performance history',
          desc: 'Hashrate and share rate samples per worker within the given time range. Used for per-worker hashrate charts.',
          params: [
            { name: 'address', type: 'path', inputType: 'text', placeholder: 'web1p...', hint: '', required: true },
            {
              name: 'mode', type: 'query', inputType: 'select', placeholder: '',
              options: [{ value: '', label: '— range —' }, { value: 'hour', label: 'Hour' }, { value: 'day', label: 'Day (default)' }, { value: 'month', label: 'Month' }],
              hint: 'Sample range',
            },
          ],
        },
      ],
    },
    {
      group: 'Miner Blocks',
      items: [
        {
          id: 'getMinerBlocks',
          method: 'GET',
          path: '/api/pools/{poolId}/miners/{address}/blocks',
          summary: 'Blocks found by miner',
          desc: 'Paginated list of blocks found by this specific miner address.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
        {
          id: 'getMinerBlocksV2',
          method: 'GET',
          path: '/api/v2/pools/{poolId}/miners/{address}/blocks',
          summary: 'Miner blocks (v2 — paginated)',
          desc: 'Same as v1 with pageCount and itemCount metadata.',
          v2: true,
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
      ],
    },
    {
      group: 'Miner Payments',
      items: [
        {
          id: 'getMinerPayments',
          method: 'GET',
          path: '/api/pools/{poolId}/miners/{address}/payments',
          summary: 'Miner payment history',
          desc: 'All payments sent to this miner address, with tx hash and explorer link.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
        {
          id: 'getMinerPaymentsV2',
          method: 'GET',
          path: '/api/v2/pools/{poolId}/miners/{address}/payments',
          summary: 'Miner payments (v2 — paginated)',
          v2: true,
          desc: 'Same as v1 with pagination metadata.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
        {
          id: 'getMinerBalanceChanges',
          method: 'GET',
          path: '/api/pools/{poolId}/miners/{address}/balancechanges',
          summary: 'Balance changes',
          desc: 'Full history of balance adjustments (credits, debits, payouts) for a miner.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
        {
          id: 'getMinerBalanceChangesV2',
          method: 'GET',
          path: '/api/v2/pools/{poolId}/miners/{address}/balancechanges',
          summary: 'Balance changes (v2)',
          v2: true,
          desc: 'Same as v1 with pagination metadata.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
        {
          id: 'getMinerEarningsDaily',
          method: 'GET',
          path: '/api/pools/{poolId}/miners/{address}/earnings/daily',
          summary: 'Daily earnings',
          desc: 'Aggregated earnings per calendar day. Useful for earnings charts.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
        {
          id: 'getMinerEarningsDailyV2',
          method: 'GET',
          path: '/api/v2/pools/{poolId}/miners/{address}/earnings/daily',
          summary: 'Daily earnings (v2)',
          v2: true,
          desc: 'Same as v1 with pagination metadata.',
          params: [
            { name: 'address',  type: 'path',  inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'page',     type: 'query', inputType: 'number', placeholder: '0',       hint: '' },
            { name: 'pageSize', type: 'query', inputType: 'number', placeholder: '15',      hint: '' },
          ],
        },
      ],
    },
    {
      group: 'Miner Settings',
      items: [
        {
          id: 'getMinerSettings',
          method: 'GET',
          path: '/api/pools/{poolId}/miners/{address}/settings',
          summary: 'Get miner settings',
          desc: 'Returns the miner\'s current payment threshold setting.',
          params: [
            { name: 'address', type: 'path', inputType: 'text', placeholder: 'web1p...', hint: '', required: true },
          ],
        },
        {
          id: 'setMinerSettings',
          method: 'POST',
          path: '/api/pools/{poolId}/miners/{address}/settings',
          summary: 'Update miner settings',
          desc: 'Update payment threshold. The request IP must match one of the miner\'s recently used stratum IPs — no token auth needed.',
          note: 'Auth: your IP must match a recently used mining IP for this address. Send from the same machine you mine from.',
          params: [
            { name: 'address',          type: 'path', inputType: 'text',   placeholder: 'web1p...', hint: '', required: true },
            { name: 'ipAddress',        type: 'body', inputType: 'text',   placeholder: '1.2.3.4', hint: 'Your current IP address', required: true },
            { name: 'paymentThreshold', type: 'body', inputType: 'number', placeholder: '0.01',    hint: 'Min payout amount (must be ≥ pool minimum)', required: true },
          ],
        },
      ],
    },
  ];

  /* ── RENDER HELPERS ─────────────────────────── */

  function makeBadge(method) {
    const span = document.createElement('span');
    span.className = 'ep-method ep-method-' + method.toLowerCase();
    setText(span, method);
    return span;
  }

  function makePathEl(path) {
    const code = document.createElement('code');
    code.className = 'ep-path';
    // highlight {param} segments — set via safe DOM ops
    path.split(/({[^}]+})/).forEach((seg) => {
      if (/^{/.test(seg)) {
        const s = document.createElement('span');
        s.className = 'ep-path-param';
        setText(s, seg);
        code.appendChild(s);
      } else {
        code.appendChild(document.createTextNode(seg));
      }
    });
    return code;
  }

  function makeParamRow(param) {
    const row = document.createElement('div');
    row.className = 'ep-param-row';

    const label = document.createElement('span');
    label.className = 'ep-param-label';
    setText(label, param.name);
    const badge = document.createElement('span');
    badge.className = param.required ? 'ep-param-req' : 'ep-param-opt';
    setText(badge, param.required ? '*' : param.type);
    label.appendChild(badge);
    row.appendChild(label);

    let input;
    if (param.inputType === 'select') {
      input = document.createElement('select');
      input.className = 'ep-param-input';
      (param.options || []).forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        setText(o, opt.label);
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = param.inputType === 'number' ? 'number' : 'text';
      input.className = 'ep-param-input';
      input.placeholder = param.placeholder || '';
      input.spellcheck = false;
      input.autocomplete = 'off';
    }
    input.dataset.param = param.name;
    input.dataset.paramType = param.type;
    row.appendChild(input);

    if (param.hint) {
      const hint = document.createElement('span');
      hint.className = 'ep-param-hint';
      setText(hint, param.hint);
      row.appendChild(hint);
    }

    return row;
  }

  function makeCard(ep) {
    const card = document.createElement('div');
    card.className = 'ep-card';
    card.dataset.id = ep.id;

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'ep-header';
    hdr.setAttribute('role', 'button');
    hdr.setAttribute('aria-expanded', 'false');
    hdr.appendChild(makeBadge(ep.method));
    hdr.appendChild(makePathEl(ep.path));
    if (ep.v2) {
      const v2 = document.createElement('span');
      v2.className = 'ep-v2-badge';
      setText(v2, 'v2');
      hdr.appendChild(v2);
    }
    const sum = document.createElement('span');
    sum.className = 'ep-summary';
    setText(sum, ep.summary);
    hdr.appendChild(sum);
    const chev = document.createElement('i');
    chev.className = 'fa-solid fa-chevron-down ep-chevron';
    hdr.appendChild(chev);
    card.appendChild(hdr);

    // Body
    const body = document.createElement('div');
    body.className = 'ep-body';

    if (ep.desc) {
      const desc = document.createElement('p');
      desc.className = 'ep-desc mb-3';
      setText(desc, ep.desc);
      body.appendChild(desc);
    }

    if (ep.note) {
      const note = document.createElement('div');
      note.className = 'mc-note';
      const ni = document.createElement('i');
      ni.className = 'fa-solid fa-circle-info';
      note.appendChild(ni);
      const nt = document.createElement('span');
      setText(nt, ep.note);
      note.appendChild(nt);
      body.appendChild(note);
    }

    if (ep.params.length) {
      const ps = document.createElement('div');
      ps.className = 'ep-params';
      const pt = document.createElement('div');
      pt.className = 'ep-params-title';
      setText(pt, 'Parameters');
      ps.appendChild(pt);
      ep.params.forEach((p) => ps.appendChild(makeParamRow(p)));
      body.appendChild(ps);
    }

    // Run row
    const runRow = document.createElement('div');
    runRow.className = 'ep-run-row';
    const runBtn = document.createElement('button');
    runBtn.className = 'ep-run-btn';
    runBtn.type = 'button';
    runBtn.dataset.epId = ep.id;
    const ri = document.createElement('i');
    ri.className = 'fa-solid fa-play';
    runBtn.appendChild(ri);
    const rt = document.createTextNode(' Run');
    runBtn.appendChild(rt);
    runRow.appendChild(runBtn);
    const urlPreview = document.createElement('span');
    urlPreview.className = 'ep-run-url';
    urlPreview.dataset.urlPreview = ep.id;
    runRow.appendChild(urlPreview);
    body.appendChild(runRow);

    // Response section
    const resp = document.createElement('div');
    resp.className = 'ep-response';
    resp.dataset.respArea = ep.id;
    const meta = document.createElement('div');
    meta.className = 'ep-response-meta';
    meta.dataset.respMeta = ep.id;
    resp.appendChild(meta);
    const pre = document.createElement('pre');
    pre.className = 'ep-response-body';
    pre.dataset.respBody = ep.id;
    resp.appendChild(pre);
    body.appendChild(resp);

    card.appendChild(body);
    return card;
  }

  function renderGroup(group) {
    const wrap = document.createElement('div');
    wrap.className = 'ep-group';
    const title = document.createElement('div');
    title.className = 'ep-group-title';
    setText(title, group.group);
    wrap.appendChild(title);
    group.items.forEach((ep) => wrap.appendChild(makeCard(ep)));
    return wrap;
  }

  function renderEndpoints() {
    const poolEl  = document.getElementById('endpoints-pool');
    const minerEl = document.getElementById('endpoints-miner');
    let poolCount = 0, minerCount = 0;

    POOL_ENDPOINTS.forEach((g) => {
      poolEl.appendChild(renderGroup(g));
      poolCount += g.items.length;
    });
    MINER_ENDPOINTS.forEach((g) => {
      minerEl.appendChild(renderGroup(g));
      minerCount += g.items.length;
    });

    const pc = document.getElementById('count-pool');
    const mc = document.getElementById('count-miner');
    if (pc) setText(pc, poolCount);
    if (mc) setText(mc, minerCount);
  }

  /* ── WEBSOCKET SECTION ──────────────────────── */
  let wsConn = null;

  const WS_EVENTS = [
    { name: 'Greeting',              icon: '👋', desc: 'Sent on connect. Confirms relay is active.' },
    { name: 'BlockFound',            icon: '⛏️', desc: 'A new block was found by any miner.' },
    { name: 'BlockUnlocked',         icon: '✅', desc: 'A pending block was confirmed / unlocked.' },
    { name: 'BlockUnlockProgress',   icon: '🔄', desc: 'Confirmation progress update for a pending block.' },
    { name: 'NewChainHeight',        icon: '📦', desc: 'A new block appeared on the network chain.' },
    { name: 'Payment',               icon: '💸', desc: 'A payment batch was processed and sent.' },
    { name: 'HashrateUpdated',       icon: '📊', desc: 'Periodic pool hashrate snapshot.' },
  ];

  function renderWsSection() {
    const el = document.getElementById('ws-section');

    // Info card
    const info = document.createElement('div');
    info.className = 'ws-card';
    const t = document.createElement('div');
    t.className = 'ws-card-title';
    const ti = document.createElement('i');
    ti.className = 'fa-solid fa-bolt';
    t.appendChild(ti);
    const tt = document.createTextNode(' WebSocket Notifications');
    t.appendChild(tt);
    info.appendChild(t);
    const d = document.createElement('p');
    d.className = 'ws-desc';
    setText(d, 'The pool exposes a raw WebSocket relay at /notifications. Events are JSON messages with a "type" field matching the event names below. No socket.io protocol is used — connect with native WebSocket.');
    info.appendChild(d);

    // Note
    const note = document.createElement('div');
    note.className = 'mc-note';
    const ni = document.createElement('i');
    ni.className = 'fa-solid fa-circle-info';
    note.appendChild(ni);
    const nt = document.createElement('span');
    setText(nt, 'This uses native WebSocket, not socket.io protocol. Connect to: ws://your-pool-host:4000/notifications');
    note.appendChild(nt);
    info.appendChild(note);

    // URL row
    const urlRow = document.createElement('div');
    urlRow.className = 'ws-url-row';
    const ul = document.createElement('span');
    ul.className = 'ws-url-label';
    setText(ul, 'Endpoint');
    urlRow.appendChild(ul);
    const uv = document.createElement('code');
    uv.className = 'ws-url-value';
    uv.id = 'ws-url-display';
    updateWsUrlDisplay(uv);
    urlRow.appendChild(uv);
    info.appendChild(urlRow);

    // Controls
    const ctrlRow = document.createElement('div');
    ctrlRow.className = 'd-flex align-items-center gap-3 mb-3 flex-wrap';
    const connBtn = document.createElement('button');
    connBtn.className = 'ws-btn ws-btn-connect';
    connBtn.type = 'button';
    connBtn.id = 'ws-connect';
    setText(connBtn, 'Connect');
    const discBtn = document.createElement('button');
    discBtn.className = 'ws-btn ws-btn-disconnect';
    discBtn.type = 'button';
    discBtn.id = 'ws-disconnect';
    discBtn.disabled = true;
    setText(discBtn, 'Disconnect');
    const statusEl = document.createElement('span');
    statusEl.className = 'ws-status';
    statusEl.id = 'ws-status';
    const dot = document.createElement('span');
    dot.className = 'ws-dot';
    statusEl.appendChild(dot);
    const stxt = document.createTextNode('Disconnected');
    statusEl.appendChild(stxt);
    ctrlRow.appendChild(connBtn);
    ctrlRow.appendChild(discBtn);
    ctrlRow.appendChild(statusEl);
    info.appendChild(ctrlRow);

    // Log
    const logLabel = document.createElement('div');
    logLabel.className = 'ep-params-title mb-1';
    setText(logLabel, 'Event log');
    info.appendChild(logLabel);
    const log = document.createElement('div');
    log.className = 'ws-log';
    log.id = 'ws-log';
    const empty = document.createElement('span');
    empty.style.color = 'var(--text-muted)';
    setText(empty, 'Connect to start receiving events...');
    log.appendChild(empty);
    info.appendChild(log);

    el.appendChild(info);

    // Events reference card
    const evCard = document.createElement('div');
    evCard.className = 'ws-card';
    const et = document.createElement('div');
    et.className = 'ws-card-title';
    const eti = document.createElement('i');
    eti.className = 'fa-solid fa-list';
    et.appendChild(eti);
    et.appendChild(document.createTextNode(' Event Reference'));
    evCard.appendChild(et);
    const ed = document.createElement('p');
    ed.className = 'ws-desc';
    setText(ed, 'Each WebSocket message is a JSON object: { "type": "EventName", ... }. Field names below the event type describe the payload.');
    evCard.appendChild(ed);

    const grid = document.createElement('div');
    grid.className = 'ws-events-grid';
    WS_EVENTS.forEach((ev) => {
      const chip = document.createElement('div');
      chip.className = 'ws-event-chip';
      const ico = document.createElement('span');
      ico.className = 'ws-event-icon';
      setText(ico, ev.icon);
      chip.appendChild(ico);
      const info2 = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'ws-event-name';
      setText(name, ev.name);
      const desc2 = document.createElement('div');
      desc2.className = 'ws-event-desc';
      setText(desc2, ev.desc);
      info2.appendChild(name);
      info2.appendChild(desc2);
      chip.appendChild(info2);
      grid.appendChild(chip);
    });
    evCard.appendChild(grid);
    el.appendChild(evCard);

    // Code example card
    const codeCard = document.createElement('div');
    codeCard.className = 'ws-card';
    const ct2 = document.createElement('div');
    ct2.className = 'ws-card-title';
    const cti = document.createElement('i');
    cti.className = 'fa-solid fa-code';
    ct2.appendChild(cti);
    ct2.appendChild(document.createTextNode(' JavaScript Example'));
    codeCard.appendChild(ct2);
    const pre = document.createElement('pre');
    pre.className = 'ep-example';
    const codeEx =
`const ws = new WebSocket('ws://your-pool-host:4000/notifications');

ws.onopen = () => console.log('connected');

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  switch (msg.type) {
    case 'BlockFound':
      console.log('Block found!', msg.poolId, msg.blockHeight);
      break;
    case 'Payment':
      console.log('Payment sent', msg.address, msg.amount);
      break;
    case 'HashrateUpdated':
      console.log('Hashrate', msg.poolId, msg.poolHashrate);
      break;
  }
};

ws.onclose = () => console.log('disconnected');`;
    setText(pre, codeEx);
    codeCard.appendChild(pre);
    el.appendChild(codeCard);
  }

  function updateWsUrlDisplay(el) {
    const base = cfg.baseUrl.replace(/^https?/, (p) => (p === 'https' ? 'wss' : 'ws'));
    setText(el || document.getElementById('ws-url-display'), base + '/notifications');
  }

  /* ── WS EVENT HANDLERS ──────────────────────── */
  function wsConnect() {
    const base = cfg.baseUrl.replace(/^https?/, (p) => (p === 'https' ? 'wss' : 'ws'));
    const url = base + '/notifications';
    try {
      wsConn = new WebSocket(url);
      wsLogEntry('sys', 'Connecting to ' + url + '...');
      wsSetStatus('connecting', 'Connecting…');

      wsConn.onopen = () => {
        wsSetStatus('connected', 'Connected');
        wsLogEntry('sys', 'Connection established');
        document.getElementById('ws-connect').disabled = true;
        document.getElementById('ws-disconnect').disabled = false;
      };

      wsConn.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          wsLogEntry('in', JSON.stringify(msg, null, 2));
        } catch {
          wsLogEntry('in', e.data);
        }
      };

      wsConn.onerror = () => {
        wsSetStatus('error', 'Error');
        wsLogEntry('sys', 'Connection error');
      };

      wsConn.onclose = (e) => {
        wsSetStatus('', 'Disconnected');
        wsLogEntry('sys', 'Disconnected (code ' + e.code + ')');
        document.getElementById('ws-connect').disabled = false;
        document.getElementById('ws-disconnect').disabled = true;
        wsConn = null;
      };
    } catch (err) {
      wsLogEntry('sys', 'Failed: ' + err.message);
    }
  }

  function wsDisconnect() {
    if (wsConn) { wsConn.close(); wsConn = null; }
  }

  function wsSetStatus(cls, text) {
    const el = document.getElementById('ws-status');
    if (!el) return;
    el.className = 'ws-status ' + cls;
    const dot = el.querySelector('.ws-dot');
    if (!dot) return;
    el.textContent = '';
    el.appendChild(dot);
    el.appendChild(document.createTextNode(' ' + text));
  }

  function wsLogEntry(type, msg) {
    const log = document.getElementById('ws-log');
    if (!log) return;
    if (log.childElementCount === 1 && log.firstChild?.style?.color) log.innerHTML = '';

    const now = new Date().toTimeString().slice(0, 8);
    const row = document.createElement('div');
    row.className = 'ws-log-entry';

    const t = document.createElement('span');
    t.className = 'ws-log-time';
    setText(t, now);

    const tp = document.createElement('span');
    tp.className = 'ws-log-type ws-log-type-' + type;
    setText(tp, type === 'in' ? '←' : type === 'out' ? '→' : '·');

    const m = document.createElement('span');
    m.className = 'ws-log-msg';
    setText(m, msg);

    row.appendChild(t);
    row.appendChild(tp);
    row.appendChild(m);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  /* ── URL PREVIEW ────────────────────────────── */
  function resolveEndpoint(ep, card) {
    const pathVars = {}, queryVars = {}, bodyVars = {};
    pathVars.poolId = cfg.poolId;

    card.querySelectorAll('[data-param]').forEach((input) => {
      const name = input.dataset.param;
      const type = input.dataset.paramType;
      const val  = input.value.trim();
      if (!val) return;
      if (type === 'path')  pathVars[name]  = val;
      if (type === 'query') queryVars[name] = val;
      if (type === 'body')  bodyVars[name]  = val;
    });

    const url = buildUrl(ep.path, pathVars, queryVars);
    return { url, bodyVars };
  }

  function updatePreview(ep, card) {
    const preview = card.querySelector('[data-url-preview]');
    if (!preview) return;
    try {
      const { url } = resolveEndpoint(ep, card);
      setText(preview, url);
    } catch {}
  }

  /* ── RUN REQUEST ────────────────────────────── */
  async function runEndpoint(epId) {
    // find endpoint def
    const allEps = [...POOL_ENDPOINTS, ...MINER_ENDPOINTS].flatMap((g) => g.items);
    const ep = allEps.find((e) => e.id === epId);
    if (!ep) return;
    if (!cfg.baseUrl) { alert('Set Base URL first.'); return; }

    const card   = document.querySelector('[data-id="' + epId + '"]');
    const runBtn = card.querySelector('[data-ep-id="' + epId + '"]');
    const respEl = card.querySelector('[data-resp-area="' + epId + '"]');
    const metaEl = card.querySelector('[data-resp-meta="' + epId + '"]');
    const bodyEl = card.querySelector('[data-resp-body="' + epId + '"]');

    // collect params
    const { url, bodyVars } = resolveEndpoint(ep, card);

    // button spinner
    runBtn.disabled = true;
    runBtn.innerHTML = '';
    const sp = document.createElement('span');
    sp.className = 'ep-spinner';
    runBtn.appendChild(sp);
    runBtn.appendChild(document.createTextNode(' Running…'));

    // build body for POST
    let body = null;
    if (ep.method === 'POST' && Object.keys(bodyVars).length) {
      body = {};
      // merge paymentThreshold into settings sub-object per API spec
      if (bodyVars.paymentThreshold !== undefined) {
        body.ipAddress = bodyVars.ipAddress || '';
        body.settings  = { paymentThreshold: parseFloat(bodyVars.paymentThreshold) || 0 };
      } else {
        Object.assign(body, bodyVars);
      }
    }

    try {
      const res = await apiRequest(ep.method, url, body);

      // meta
      metaEl.innerHTML = '';
      const statusSpan = document.createElement('span');
      statusSpan.className = res.ok ? 'ep-status-ok' : 'ep-status-err';
      setText(statusSpan, res.status + (res.ok ? ' OK' : ' Error'));
      const timeSpan = document.createElement('span');
      timeSpan.className = 'ep-resp-time';
      setText(timeSpan, res.elapsed + ' ms');
      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'ep-resp-size';
      setText(sizeSpan, fmtBytes(new Blob([res.text]).size));
      metaEl.appendChild(statusSpan);
      metaEl.appendChild(timeSpan);
      metaEl.appendChild(sizeSpan);

      // body — try pretty JSON, else raw text
      try {
        const json = JSON.parse(res.text);
        const pretty = JSON.stringify(json, null, 2);
        bodyEl.innerHTML = highlightJson(pretty); // safe: entities escaped before regex
      } catch {
        bodyEl.textContent = res.text;
      }

      respEl.classList.add('visible');
    } catch (err) {
      metaEl.innerHTML = '';
      const errSpan = document.createElement('span');
      errSpan.className = 'ep-status-err';
      setText(errSpan, 'Network error: ' + err.message);
      metaEl.appendChild(errSpan);
      bodyEl.textContent = '';
      respEl.classList.add('visible');
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML = '';
      const ic = document.createElement('i');
      ic.className = 'fa-solid fa-play';
      runBtn.appendChild(ic);
      runBtn.appendChild(document.createTextNode(' Run'));
    }
  }

  /* ── POOL SELECTOR ──────────────────────────── */
  async function loadPools() {
    if (!cfg.baseUrl) return;
    try {
      const res = await apiRequest('GET', cfg.baseUrl + '/api/pools', null);
      if (!res.ok) return;
      const data = JSON.parse(res.text);
      const pools = data.pools || [];
      const sel = document.getElementById('pool-select');
      sel.innerHTML = '';
      pools.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        setText(o, p.id + ' — ' + (p.coin?.symbol || ''));
        if (p.id === cfg.poolId) o.selected = true;
        sel.appendChild(o);
      });
      if (pools.length && !cfg.poolId) {
        cfg.poolId = pools[0].id;
        sel.value = cfg.poolId;
        localStorage.setItem('mc_pool_id', cfg.poolId);
      }
    } catch {}
  }

  /* ── EVENT BINDING ──────────────────────────── */
  function bindEvents() {
    // Theme
    document.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.addEventListener('click', () => Theme.set(btn.dataset.theme));
    });

    // Apply URL
    document.getElementById('apply-url')?.addEventListener('click', () => {
      const input = document.getElementById('base-url');
      cfg.baseUrl = input.value.trim().replace(/\/$/, '');
      localStorage.setItem('mc_base_url', cfg.baseUrl);
      updateWsUrlDisplay();
      loadPools();
    });

    // Pool selector
    document.getElementById('pool-select')?.addEventListener('change', (e) => {
      cfg.poolId = e.target.value;
      localStorage.setItem('mc_pool_id', cfg.poolId);
    });

    // Endpoint card toggle
    document.addEventListener('click', (e) => {
      const hdr = e.target.closest('.ep-header');
      if (!hdr) return;
      const card = hdr.closest('.ep-card');
      if (!card) return;
      const wasOpen = card.classList.contains('open');
      card.classList.toggle('open', !wasOpen);
      hdr.setAttribute('aria-expanded', String(!wasOpen));
    });

    // Run button
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ep-id]');
      if (!btn) return;
      e.stopPropagation();
      runEndpoint(btn.dataset.epId);
    });

    // Live URL preview on param input
    document.addEventListener('input', (e) => {
      const input = e.target.closest('[data-param]');
      if (!input) return;
      const card = input.closest('[data-id]');
      if (!card) return;
      const epId = card.dataset.id;
      const allEps = [...POOL_ENDPOINTS, ...MINER_ENDPOINTS].flatMap((g) => g.items);
      const ep = allEps.find((x) => x.id === epId);
      if (ep) updatePreview(ep, card);
    });

    // WS connect/disconnect
    document.getElementById('ws-connect')?.addEventListener('click', wsConnect);
    document.getElementById('ws-disconnect')?.addEventListener('click', wsDisconnect);
  }

  /* ── INIT ───────────────────────────────────── */
  function init() {
    Theme.init();
    renderEndpoints();
    renderWsSection();
    bindEvents();

    // restore base URL
    const urlInput = document.getElementById('base-url');
    if (urlInput) urlInput.value = cfg.baseUrl;

    // auto-load pools if URL is set
    if (cfg.baseUrl) loadPools();

    // update WS display
    updateWsUrlDisplay();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
