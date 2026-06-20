<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

type JsonRecord = Record<string, unknown>;
type StatusKind = 'idle' | 'ok' | 'warn' | 'error';

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
const scopeOptions = [
  { value: 'messages:send', label: 'Enviar mensagens' },
  { value: 'messages:read', label: 'Ler mensagens' },
  { value: 'contacts:read', label: 'Ler contatos' },
  { value: 'notifications:subscribe', label: 'Receber eventos' }
];

const settings = reactive({
  baseUrl: localStorage.getItem('peercomms.baseUrl') ?? 'http://127.0.0.1:17345',
  token: localStorage.getItem('peercomms.token') ?? ''
});
const identity = ref<unknown>({});
const contacts = ref<JsonRecord[]>([]);
const conversations = ref<JsonRecord[]>([]);
const notifications = ref<JsonRecord[]>([]);
const networkPeers = ref<JsonRecord[]>([]);
const messages = ref<unknown>({});
const eventFeed = ref<Array<{ type: string; data: unknown; at: string }>>([]);
const status = reactive<{ kind: StatusKind; text: string }>({ kind: 'idle', text: 'API inativa' });
const toast = ref('');
const contactForm = reactive({ localPeerId: '', remotePeerId: '', message: '' });
const messageForm = reactive({ fromPeerId: '', toPeerId: '', text: '' });
const integrationForm = reactive({ name: 'Desktop', appId: '', scopes: ['messages:send', 'notifications:subscribe'] as string[] });
let eventSource: EventSource | null = null;
let toastTimer: number | undefined;

const connectionSummary = computed(() => settings.token ? `Conectado a ${settings.baseUrl}` : `Sem token em ${settings.baseUrl}`);
const statusClass = computed(() => `status-${status.kind}`);

onMounted(() => {
  void refreshAll();
});

onBeforeUnmount(() => {
  eventSource?.close();
  if (toastTimer) window.clearTimeout(toastTimer);
});

function saveSettings(): void {
  settings.baseUrl = settings.baseUrl.replace(/\/$/, '');
  localStorage.setItem('peercomms.baseUrl', settings.baseUrl);
  localStorage.setItem('peercomms.token', settings.token);
  notify('Configuracoes salvas');
}

async function refreshAll(): Promise<void> {
  await runTask('Atualizando dados', async () => {
    await Promise.allSettled([loadIdentity(), loadContacts(), loadConversations(), loadNotifications(), loadNetworkPeers()]);
  });
}

async function loadIdentity(): Promise<void> {
  identity.value = await request('/v1/identity/public');
}

async function loadContacts(): Promise<void> {
  contacts.value = collection(await request('/v1/contacts'));
}

async function loadConversations(): Promise<void> {
  conversations.value = collection(await request('/v1/conversations'));
}

async function loadNotifications(): Promise<void> {
  notifications.value = collection(await request('/v1/notifications?limit=50'));
}

async function loadNetworkPeers(): Promise<void> {
  networkPeers.value = collection(await request('/v1/network/peers?limit=50'));
}

async function markNotificationRead(notificationId: string): Promise<void> {
  await runTask('Marcando notificacao como lida', async () => {
    await request(`/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
    await loadNotifications();
  });
}

async function loadMessages(conversationId: string): Promise<void> {
  if (!conversationId) return;
  await runTask('Carregando mensagens', async () => {
    messages.value = await request(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`);
  });
}

async function registerApplication(): Promise<void> {
  await runTask('Registrando aplicativo', async () => {
    const result = await request('/v1/integrations/apps', { method: 'POST', body: { name: integrationForm.name }, authenticated: false }) as { appId?: string };
    integrationForm.appId = result.appId ?? '';
    notify(`Aplicativo ${integrationForm.appId} registrado`);
  });
}

async function createToken(): Promise<void> {
  await runTask('Criando token', async () => {
    const scopes = [...integrationForm.scopes];
    if (scopes.length === 0) throw new Error('Selecione ao menos um escopo para o token');
    const result = await request('/v1/integrations/tokens', { method: 'POST', body: { appId: integrationForm.appId, scopes } }) as { token?: string; tokenId?: string };
    settings.token = result.token ?? '';
    saveSettings();
    notify(`Token ${result.tokenId ?? ''} criado`);
  });
}

async function sendContactRequest(): Promise<void> {
  await runTask('Enviando solicitacao', async () => {
    await request('/v1/contacts/requests', { method: 'POST', body: { ...contactForm } });
    contactForm.message = '';
    await loadContacts();
    notify('Solicitacao enviada');
  });
}

async function sendDirectMessage(): Promise<void> {
  await runTask('Enfileirando mensagem', async () => {
    messages.value = await request('/v1/messages/direct', { method: 'POST', body: { ...messageForm } });
    messageForm.text = '';
    notify('Mensagem enfileirada');
  });
}

function connectEvents(): void {
  eventSource?.close();
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  eventSource = new EventSource(`${settings.baseUrl}/v1/events/stream`);
  eventSource.onopen = () => setStatus('ok', 'Eventos conectados');
  eventSource.onerror = () => setStatus('warn', 'Reconectando eventos');
  for (const eventName of eventNames) {
    eventSource.addEventListener(eventName, (event) => {
      const data = safeJson((event as MessageEvent<string>).data);
      eventFeed.value.unshift({ type: eventName, data, at: new Date().toLocaleTimeString() });
      if (eventName === 'notification.created' && data && typeof data === 'object') {
        const notification = data as JsonRecord;
        notifications.value.unshift(notification);
        showSystemNotification(notification);
      }
      if (eventName === 'peer.connected' || eventName === 'peer.disconnected') void loadNetworkPeers();
    });
  }
  eventFeed.value.unshift({ type: 'stream.open', data: { baseUrl: settings.baseUrl }, at: new Date().toLocaleTimeString() });
}

async function runTask(label: string, task: () => Promise<void>): Promise<void> {
  setStatus('warn', label);
  try {
    await task();
    setStatus('ok', 'API pronta');
  } catch (error) {
    setStatus('error', 'Erro na API');
    notify(error instanceof Error ? error.message : 'Erro inesperado');
  }
}

async function request(path: string, options: { method?: string; body?: unknown; authenticated?: boolean } = {}): Promise<unknown> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.authenticated !== false && settings.token) headers.authorization = `Bearer ${settings.token}`;
  const init: RequestInit = { method: options.method ?? 'GET', headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${settings.baseUrl}${path}`, init);
  const payload = await response.json().catch(() => undefined) as unknown;
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? String((payload as JsonRecord).error) : `Requisicao falhou (${response.status})`;
    throw new Error(error);
  }
  return payload;
}

function collection(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object');
  if (value && typeof value === 'object' && Array.isArray((value as JsonRecord).items)) return collection((value as JsonRecord).items);
  return [];
}

function label(item: JsonRecord, fields: string[]): string {
  for (const field of fields) if (item[field]) return String(item[field]);
  return 'Sem identificador';
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function safeJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

function setStatus(kind: StatusKind, text: string): void {
  status.kind = kind;
  status.text = text;
}

function notify(message: string): void {
  toast.value = message;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.value = ''; }, 3_200);
}

function showSystemNotification(notification: JsonRecord): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(String(notification.title ?? 'PeerComms'), {
    body: typeof notification.body === 'string' ? notification.body : String(notification.type ?? 'Novo evento')
  });
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="Navegacao principal">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">PC</span>
        <div><strong>PeerComms</strong><span>No local</span></div>
      </div>
      <nav class="nav-list">
        <a class="nav-item is-active" href="#identidade">Identidade</a>
        <a class="nav-item" href="#contatos">Contatos</a>
        <a class="nav-item" href="#mensagens">Mensagens</a>
        <a class="nav-item" href="#notificacoes">Notificacoes</a>
        <a class="nav-item" href="#rede">Rede</a>
        <a class="nav-item" href="#eventos">Eventos</a>
        <a class="nav-item" href="#conexao">Conexao</a>
      </nav>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div><h1>PeerComms Console</h1><span class="subtle">{{ connectionSummary }}</span></div>
        <div class="status-strip"><span class="status-pill" :class="statusClass">{{ status.text }}</span><button class="primary-button" type="button" @click="refreshAll">Atualizar</button></div>
      </header>

      <section id="conexao" class="workspace-panel settings-panel">
        <div class="panel-heading"><h2>Conexao local</h2></div>
        <form class="settings-grid" @submit.prevent="saveSettings">
          <label><span class="field-label">URL da API <button class="field-help" type="button" aria-label="Ajuda sobre URL da API" data-tooltip="Endereco local do daemon. Mantenha 127.0.0.1 e a porta configurada no daemon.">i</button></span><input v-model="settings.baseUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false" required></label>
          <label><span class="field-label">Token bearer <button class="field-help" type="button" aria-label="Ajuda sobre token bearer" data-tooltip="Credencial gerada para este app. Ela libera somente os escopos selecionados e fica salva neste dispositivo.">i</button></span><input v-model="settings.token" type="password" autocomplete="current-password" spellcheck="false"></label>
          <button class="primary-button" type="submit">Salvar</button>
        </form>
      </section>

      <div class="dashboard-grid">
        <section id="identidade" class="workspace-panel"><div class="panel-heading"><h2>Identidade</h2><button type="button" @click="loadIdentity">Carregar</button></div><pre class="json-output">{{ pretty(identity) }}</pre></section>
        <section class="workspace-panel">
          <div class="panel-heading"><h2>Integracao</h2></div>
          <form class="stack-form" @submit.prevent="registerApplication"><label><span class="field-label">Nome do app <button class="field-help" type="button" aria-label="Ajuda sobre nome do app" data-tooltip="Nome usado para identificar esta instalacao ao emitir tokens e auditar integracoes locais.">i</button></span><input v-model="integrationForm.name" required></label><button type="submit">Registrar app</button></form>
          <form class="stack-form" @submit.prevent="createToken"><label><span class="field-label">App ID <button class="field-help" type="button" aria-label="Ajuda sobre App ID" data-tooltip="Identificador retornado ao registrar o app. Ele vincula o token a esta integracao.">i</button></span><input v-model="integrationForm.appId" placeholder="app_..." required></label><fieldset class="scope-field"><legend class="field-label">Escopos <button class="field-help" type="button" aria-label="Ajuda sobre escopos" data-tooltip="Permissoes concedidas ao token. Selecione apenas o que esta tela precisa para seguir o principio do menor privilegio.">i</button></legend><label v-for="scope in scopeOptions" :key="scope.value" class="scope-option"><input v-model="integrationForm.scopes" type="checkbox" :value="scope.value"><span>{{ scope.label }}</span></label></fieldset><button type="submit">Criar token</button></form>
        </section>
      </div>

      <div class="content-grid">
        <section id="contatos" class="workspace-panel">
          <div class="panel-heading"><h2>Contatos</h2><button type="button" @click="loadContacts">Carregar</button></div>
          <form class="stack-form" @submit.prevent="sendContactRequest"><label><span class="field-label">Peer local <button class="field-help" type="button" aria-label="Ajuda sobre peer local" data-tooltip="Seu identificador publico. Copie-o da secao Identidade para registrar uma solicitacao de contato.">i</button></span><input v-model="contactForm.localPeerId" placeholder="pc_..." required></label><label><span class="field-label">Peer remoto <button class="field-help" type="button" aria-label="Ajuda sobre peer remoto" data-tooltip="Identificador publico da pessoa ou dispositivo que voce quer adicionar. Confira-o por um canal confiavel.">i</button></span><input v-model="contactForm.remotePeerId" placeholder="pc_..." required></label><label><span class="field-label">Mensagem <button class="field-help" type="button" aria-label="Ajuda sobre mensagem de contato" data-tooltip="Contexto opcional para ajudar a outra pessoa a reconhecer seu pedido de contato.">i</button></span><input v-model="contactForm.message" placeholder="Opcional"></label><button type="submit">Enviar solicitacao</button></form>
          <div class="item-list scroll-region"><div v-if="contacts.length === 0" class="list-item">Nenhum contato</div><div v-for="contact in contacts" :key="label(contact, ['peerId', 'id'])" class="list-item"><strong>{{ label(contact, ['alias', 'peerId', 'id']) }}</strong><span>{{ label(contact, ['status', 'updatedAt']) }}</span></div></div>
        </section>

        <section id="mensagens" class="workspace-panel message-panel">
          <div class="panel-heading"><h2>Mensagens</h2><button type="button" @click="loadConversations">Carregar</button></div>
          <div class="split-panel"><div class="item-list scroll-region"><div v-if="conversations.length === 0" class="list-item">Nenhuma conversa</div><button v-for="conversation in conversations" :key="label(conversation, ['id'])" class="conversation-row" type="button" @click="loadMessages(label(conversation, ['id']))"><strong>{{ label(conversation, ['peerId', 'groupId', 'id']) }}</strong><span>{{ label(conversation, ['updatedAt', 'type']) }}</span></button></div><div class="message-compose"><form class="stack-form" @submit.prevent="sendDirectMessage"><label><span class="field-label">Peer remetente <button class="field-help" type="button" aria-label="Ajuda sobre peer remetente" data-tooltip="Seu peer ID publico. Deve ser o mesmo identificador da sua identidade local.">i</button></span><input v-model="messageForm.fromPeerId" placeholder="pc_..." required></label><label><span class="field-label">Peer destinatario <button class="field-help" type="button" aria-label="Ajuda sobre peer destinatario" data-tooltip="Peer ID de um contato aceito. A mensagem e criptografada antes de entrar na fila de entrega.">i</button></span><input v-model="messageForm.toPeerId" placeholder="pc_..." required></label><label><span class="field-label">Mensagem <button class="field-help" type="button" aria-label="Ajuda sobre mensagem direta" data-tooltip="Conteudo que sera criptografado localmente. O envio pode ficar na fila enquanto o contato estiver indisponivel.">i</button></span><textarea v-model="messageForm.text" rows="5" placeholder="Escreva uma mensagem direta" required></textarea></label><button class="primary-button" type="submit">Enfileirar mensagem</button></form><pre class="json-output">{{ pretty(messages) }}</pre></div></div>
        </section>
      </div>

      <div class="content-grid">
        <section id="notificacoes" class="workspace-panel">
          <div class="panel-heading"><h2>Notificacoes</h2><button type="button" @click="loadNotifications">Carregar</button></div>
          <div class="item-list scroll-region"><div v-if="notifications.length === 0" class="list-item">Nenhuma notificacao</div><div v-for="notification in notifications" :key="label(notification, ['id'])" class="list-item"><strong>{{ label(notification, ['title', 'type']) }}</strong><span>{{ label(notification, ['body', 'type']) }}</span><span>{{ label(notification, ['createdAt']) }}</span><button v-if="!notification.readAt" type="button" @click="markNotificationRead(label(notification, ['id']))">Marcar como lida</button></div></div>
        </section>

        <section id="rede" class="workspace-panel">
          <div class="panel-heading"><h2>Alcance da rede</h2><button type="button" @click="loadNetworkPeers">Atualizar</button></div>
          <div class="item-list scroll-region"><div v-if="networkPeers.length === 0" class="list-item">Nenhum peer de transporte observado</div><div v-for="peer in networkPeers" :key="label(peer, ['peerId'])" class="list-item"><strong>{{ label(peer, ['peerId']) }}</strong><span>{{ label(peer, ['reachability']) }}</span><span>{{ label(peer, ['lastSeenAt']) }}</span></div></div>
        </section>
      </div>

      <section id="eventos" class="workspace-panel"><div class="panel-heading"><h2>Eventos</h2><div class="button-row"><button type="button" @click="connectEvents">Conectar</button><button type="button" @click="eventFeed = []">Limpar</button></div></div><div class="event-feed"><div v-if="eventFeed.length === 0" class="event-row">Nenhum evento recebido</div><div v-for="event in eventFeed" :key="`${event.at}-${event.type}`" class="event-row"><time>{{ event.at }}</time><strong>{{ event.type }}</strong><span>{{ pretty(event.data) }}</span></div></div></section>
    </main>
  </div>
  <div v-if="toast" class="toast" role="status" aria-live="polite">{{ toast }}</div>
</template>
