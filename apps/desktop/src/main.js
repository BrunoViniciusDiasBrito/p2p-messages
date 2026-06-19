const eventNames = [
  'contact.request.received',
  'contact.request.approved',
  'message.received',
  'message.sent',
  'message.failed',
  'group.invitation.received',
  'group.member.added',
  'notification.created',
  'peer.connected',
  'peer.disconnected'
];

const state = {
  baseUrl: localStorage.getItem('peercomms.baseUrl') ?? 'http://127.0.0.1:17345',
  token: localStorage.getItem('peercomms.token') ?? '',
  eventSource: null
};

const $ = (selector) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  return element;
};

const fields = {
  baseUrl: $('#baseUrl'),
  apiToken: $('#apiToken'),
  connectionSummary: $('#connectionSummary'),
  apiStatus: $('#apiStatus'),
  identityOutput: $('#identityOutput'),
  messagesOutput: $('#messagesOutput'),
  contactsList: $('#contactsList'),
  conversationList: $('#conversationList'),
  eventFeed: $('#eventFeed'),
  toast: $('#toast')
};

fields.baseUrl.value = state.baseUrl;
fields.apiToken.value = state.token;
updateConnectionSummary();

document.querySelectorAll('.nav-item').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('is-active'));
    link.classList.add('is-active');
  });
});

$('#settingsForm').addEventListener('submit', (event) => {
  event.preventDefault();
  state.baseUrl = String(fields.baseUrl.value || '').replace(/\/$/, '');
  state.token = String(fields.apiToken.value || '');
  localStorage.setItem('peercomms.baseUrl', state.baseUrl);
  localStorage.setItem('peercomms.token', state.token);
  updateConnectionSummary();
  showToast('Settings saved');
});

$('#refreshAll').addEventListener('click', () => {
  void refreshAll();
});

$('#loadIdentity').addEventListener('click', () => {
  void runTask('Loading identity', loadIdentity);
});

$('#loadContacts').addEventListener('click', () => {
  void runTask('Loading contacts', loadContacts);
});

$('#loadConversations').addEventListener('click', () => {
  void runTask('Loading conversations', loadConversations);
});

$('#clearEvents').addEventListener('click', () => {
  fields.eventFeed.innerHTML = '';
});

$('#connectEvents').addEventListener('click', () => {
  connectEvents();
});

$('#registerAppForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  void runTask('Registering app', async () => {
    const result = await api('/v1/integrations/apps', { method: 'POST', body: { name: String(input.name ?? '') }, authenticated: false });
    showToast(`Registered ${result.appId}`);
    const appIdInput = document.querySelector('#tokenForm input[name="appId"]');
    if (appIdInput) appIdInput.value = result.appId;
  });
});

$('#tokenForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  const scopes = String(input.scopes ?? '').split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
  void runTask('Creating token', async () => {
    const result = await api('/v1/integrations/tokens', { method: 'POST', body: { appId: String(input.appId ?? ''), scopes } });
    state.token = result.token;
    fields.apiToken.value = result.token;
    localStorage.setItem('peercomms.token', result.token);
    updateConnectionSummary();
    showToast(`Token ${result.tokenId} created`);
  });
});

$('#contactRequestForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  void runTask('Sending contact request', async () => {
    await api('/v1/contacts/requests', {
      method: 'POST',
      body: {
        localPeerId: String(input.localPeerId ?? ''),
        remotePeerId: String(input.remotePeerId ?? ''),
        message: String(input.message ?? '')
      }
    });
    showToast('Contact request queued');
    await loadContacts();
  });
});

$('#directMessageForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  void runTask('Queueing direct message', async () => {
    const result = await api('/v1/messages/direct', {
      method: 'POST',
      body: {
        fromPeerId: String(input.fromPeerId ?? ''),
        toPeerId: String(input.toPeerId ?? ''),
        text: String(input.text ?? '')
      }
    });
    fields.messagesOutput.textContent = pretty(result);
    showToast('Message queued');
  });
});

async function refreshAll() {
  await runTask('Refreshing', async () => {
    await Promise.allSettled([loadIdentity(), loadContacts(), loadConversations()]);
  });
}

async function loadIdentity() {
  const identity = await api('/v1/identity/public');
  fields.identityOutput.textContent = pretty(identity);
}

async function loadContacts() {
  const contacts = await api('/v1/contacts');
  renderList(fields.contactsList, normalizeCollection(contacts), {
    empty: 'No contacts',
    title: (item) => item.alias ?? item.peerId ?? item.id ?? 'Contact',
    meta: (item) => item.status ?? item.updatedAt ?? ''
  });
}

async function loadConversations() {
  const conversations = await api('/v1/conversations');
  renderList(fields.conversationList, normalizeCollection(conversations), {
    empty: 'No conversations',
    title: (item) => item.peerId ?? item.groupId ?? item.id ?? 'Conversation',
    meta: (item) => item.updatedAt ?? item.type ?? '',
    action: {
      label: 'Open',
      run: (item) => loadMessages(String(item.id ?? ''))
    }
  });
}

async function loadMessages(conversationId) {
  if (!conversationId) return;
  const messages = await api(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`);
  fields.messagesOutput.textContent = pretty(messages);
}

function connectEvents() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  const source = new EventSource(`${state.baseUrl}/v1/events/stream`);
  state.eventSource = source;
  source.onopen = () => setStatus('ok', 'SSE connected');
  source.onerror = () => setStatus('warn', 'SSE reconnecting');
  eventNames.forEach((eventName) => {
    source.addEventListener(eventName, (event) => {
      appendEvent(eventName, safeJson(event.data));
    });
  });
  appendEvent('stream.open', { baseUrl: state.baseUrl });
}

async function runTask(label, task) {
  setStatus('warn', label);
  try {
    await task();
    setStatus('ok', 'API ready');
  } catch (error) {
    setStatus('error', 'API error');
    showToast(error instanceof Error ? error.message : 'Unexpected error');
  }
}

async function api(path, options = {}) {
  const method = options.method ?? 'GET';
  const headers = { 'content-type': 'application/json' };
  if (options.authenticated !== false && state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(`${state.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload ? payload.error : `Request failed with ${response.status}`;
    throw new Error(String(message));
  }
  return payload;
}

function renderList(target, items, options) {
  target.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'list-item';
    empty.textContent = options.empty;
    target.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'list-item';
    const title = document.createElement('strong');
    title.textContent = String(options.title(item));
    const meta = document.createElement('span');
    meta.textContent = String(options.meta(item));
    row.append(title, meta);
    if (options.action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = options.action.label;
      button.addEventListener('click', () => void options.action.run(item));
      row.append(button);
    }
    target.append(row);
  }
}

function appendEvent(type, data) {
  const row = document.createElement('div');
  row.className = 'event-row';
  const time = document.createElement('time');
  time.dateTime = new Date().toISOString();
  time.textContent = new Date().toLocaleTimeString();
  const code = document.createElement('code');
  code.textContent = `${type}: ${JSON.stringify(data)}`;
  row.append(time, code);
  fields.eventFeed.prepend(row);
}

function normalizeCollection(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    for (const key of ['items', 'contacts', 'conversations', 'messages']) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function setStatus(kind, label) {
  fields.apiStatus.className = `status-pill status-${kind}`;
  fields.apiStatus.textContent = label;
}

function updateConnectionSummary() {
  const tokenState = state.token ? 'token set' : 'no token';
  fields.connectionSummary.textContent = `${state.baseUrl} - ${tokenState}`;
}

function showToast(message) {
  fields.toast.textContent = message;
  fields.toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => fields.toast.classList.remove('is-visible'), 3200);
}
