const labels = {explicit:'明确需求', opportunity:'采购机会', pending:'待核验'};
const statuses = {queued:'待执行', completed:'演示完成', cancelled:'已取消', interrupted:'中断，待人工处理'};
const gaps = {identity_verified:'企业身份', product_match:'产品匹配', contact_verified:'联系证据', source_matched:'来源原文', publication_date:'日期有效性', expired_demand:'需求已截止', demand_evidence:'采购需求'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const $ = id => document.getElementById(id);
let state = {records:[], tasks:[], paused:false};
let selectedFilter = 'all';
let selectedRecordId = null;
let requestId = crypto.randomUUID();
let connectionState = 'loading';
let busy = false;
let lastReadyAt = 0;
let staleTimer;
const CONNECTION_TIMEOUT_MS = 8000;
const STALE_AFTER_MS = 60000;

function setConnection(next, detail = '') {
  connectionState = next;
  const copy = {loading:'正在连接本地服务', ready:'本地服务已连接', error:`连接失败${detail ? `：${detail}` : ''}`, stale:'数据可能已过期，请重新连接'};
  document.querySelector('.connection').dataset.state = next;
  $('connectionStatus').textContent = copy[next];
  if (state.records.length && next !== 'ready') $('connectionStatus').textContent += '；下方保留的是旧状态，不能据此处理队列。';
  $('retry').hidden = next === 'loading' || next === 'ready';
  $('records').setAttribute('aria-busy', String(next === 'loading'));
  renderControls();
  renderQueue();
}

function scheduleStaleState() {
  clearTimeout(staleTimer);
  staleTimer = setTimeout(() => {
    if (connectionState === 'ready' && Date.now() - lastReadyAt >= STALE_AFTER_MS) setConnection('stale');
  }, STALE_AFTER_MS + 50);
}

async function request(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
  try {
    const options = {signal:controller.signal};
    if (payload) Object.assign(options, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const response = await fetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `本地服务返回 ${response.status}`);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('连接超时');
    throw error;
  } finally { clearTimeout(timeout); }
}

function acceptState(data) {
  if (!data || !Array.isArray(data.records) || !Array.isArray(data.tasks) || typeof data.paused !== 'boolean' || data.synthetic !== true || !data.records.every(record => record && typeof record.id === 'string' && Object.hasOwn(labels, record.category) && Array.isArray(record.gaps)) || !data.tasks.every(task => task && Number.isInteger(task.id) && typeof task.status === 'string')) {
    throw new Error('返回状态格式无效，队列操作已禁用');
  }
  state = data;
  lastReadyAt = Date.now();
  if (!selectedRecordId || !state.records.some(record => record.id === selectedRecordId)) selectedRecordId = state.records[0]?.id ?? null;
  setConnection('ready');
  scheduleStaleState();
  render();
}

async function loadState() {
  if (busy) return;
  busy = true;
  setConnection('loading');
  $('errorMessage').textContent = '';
  try { acceptState(await request('/api/state')); }
  catch (error) {
    setConnection('error', error.message);
    $('errorMessage').textContent = `${error.message}。请确认本地服务正在运行，然后重试。`;
    render();
  } finally { busy = false; renderControls(); }
}

function renderControls() {
  const writable = connectionState === 'ready' && !busy;
  $('enqueue').disabled = !writable;
  $('tasks').querySelectorAll('[data-cancel]').forEach(button => { button.disabled = !writable; });
  $('pause').disabled = !writable || state.paused;
  $('resume').disabled = !writable || !state.paused;
  $('next').disabled = !writable || state.paused || !state.tasks.some(task => task.status === 'queued');
  $('export').disabled = !state.records.length;
}

function renderCounts() {
  $('counts').innerHTML = Object.entries(labels).map(([key,label]) => `<div class="count"><strong>${state.records.filter(record => record.category === key).length}</strong>${label} · 合成记录</div>`).join('');
}

function renderRecords() {
  const focusedId = document.activeElement?.dataset.recordId;
  const records = state.records.filter(record => selectedFilter === 'all' || record.category === selectedFilter);
  if (records.length && !records.some(record => record.id === selectedRecordId)) selectedRecordId = records[0].id;
  $('resultCount').textContent = `${records.length} 条`;
  $('records').innerHTML = records.map(record => {
    const selected = record.id === selectedRecordId;
    const gapCopy = record.gaps.length ? `${record.gaps.length} 项缺口` : '核验项齐全';
    return `<button class="record-button" type="button" data-record-id="${esc(record.id)}" aria-pressed="${selected}" aria-label="${esc(record.name)}，${labels[record.category]}，${gapCopy}"><span class="record-top"><span class="tag ${esc(record.category)}">${labels[record.category]}</span><span class="gap-count">${gapCopy}</span></span><span class="record-name">${esc(record.name)}</span><span class="record-meta">发布 ${esc(record.published_on || '未知')} · ${esc(record.id)}</span></button>`;
  }).join('') || '<p class="empty">此分类没有合成记录。</p>';
  if (focusedId) [...$('records').querySelectorAll('[data-record-id]')].find(button => button.dataset.recordId === focusedId)?.focus();
}

function renderDetail() {
  const record = state.records.find(item => item.id === selectedRecordId);
  if (!record) {
    $('detail').innerHTML = '<div class="detail-empty"><p class="eyebrow">选中详情</p><h3 id="detailTitle">没有可显示的记录</h3><p>切换分类或重新连接本地服务。</p></div>';
    return;
  }
  const gapItems = record.gaps.length ? record.gaps.map(gap => `<li>${esc(gaps[gap] || gap)}</li>`).join('') : '<li class="clear">样例核验项齐全</li>';
  $('detail').innerHTML = `<div class="detail-head"><div><p class="eyebrow">选中详情</p><h3 id="detailTitle">${esc(record.name)}</h3></div><span class="record-id">${esc(record.id)}</span></div><p class="evidence-label">需求原文</p><blockquote>${esc(record.quote || '未提供原文')}</blockquote><dl class="facts"><div class="fact"><dt>需求分类</dt><dd><span class="tag ${esc(record.category)}">${labels[record.category]}</span></dd></div><div class="fact"><dt>采购权限</dt><dd>未知，不随分类升级</dd></div><div class="fact"><dt>发布日期</dt><dd>${esc(record.published_on || '未知')}</dd></div><div class="fact"><dt>截止日期</dt><dd>${esc(record.closes_on || '未知')}</dd></div><div class="fact"><dt>样例来源</dt><dd>${esc(record.source)}</dd></div><div class="fact"><dt>分类基准日</dt><dd>${esc(state.asof || '未知')}</dd></div></dl><section class="gaps" aria-labelledby="gaps-title"><p id="gaps-title" class="evidence-label">证据缺口</p><ul class="gap-list">${gapItems}</ul></section><section class="next-action" aria-labelledby="next-action-title"><p id="next-action-title" class="evidence-label">下一动作</p><p>${esc(record.next_action)}</p></section>`;
}

function renderQueue() {
  $('queueState').textContent = connectionState !== 'ready' ? '队列当前只读；重新连接后可操作。' : state.paused ? '队列已暂停，不领取任务。' : '队列可处理，每次只完成一条离线任务。';
  $('tasks').innerHTML = state.tasks.map(task => `<div class="task"><div>${esc(task.product)}<small>DEMO-${task.id} · ${statuses[task.status] || esc(task.status)}</small></div>${task.status === 'queued' ? `<button type="button" data-cancel="${task.id}" ${connectionState !== 'ready' || busy ? 'disabled' : ''}>取消排队</button>` : ''}</div>`).join('') || '<p class="empty">暂无任务。创建一个任务以体验本地持久队列。</p>';
}

function render() {
  if (state.records.length) { renderCounts(); renderRecords(); renderDetail(); $('asof').textContent = state.asof || '未知'; }
  renderQueue();
  renderControls();
}

async function action(path, payload) {
  if (busy || connectionState !== 'ready') return false;
  busy = true;
  $('message').textContent = '';
  $('errorMessage').textContent = '';
  renderControls(); renderQueue();
  try { acceptState(await request(path, payload)); return true; }
  catch (error) {
    setConnection('error', error.message);
    $('errorMessage').textContent = `${error.message}。输入与本次请求标识已保留，可重新连接后重试。`;
    render();
    return false;
  } finally { busy = false; renderControls(); }
}

$('retry').addEventListener('click', loadState);
$('form').addEventListener('submit', async event => {
  event.preventDefault();
  if (await action('/api/enqueue', {product:$('product').value, request_id:requestId})) {
    requestId = crypto.randomUUID();
    $('message').textContent = '演示任务已保存。结果固定，不代表实际搜索。';
  }
});
try { $('product').value = sessionStorage.getItem('buyer-demo-product') || $('product').value; } catch {}
$('product').addEventListener('input', () => { requestId = crypto.randomUUID(); try { sessionStorage.setItem('buyer-demo-product', $('product').value); } catch {} });
for (const [id,path] of [['pause','pause'],['resume','resume'],['next','next']]) $(id).addEventListener('click', () => action(`/api/${path}`, {}));
$('tasks').addEventListener('click', event => { const cancelId = event.target.dataset.cancel; if (cancelId) action('/api/cancel', {id:Number(cancelId)}); });
$('records').addEventListener('click', event => { const button = event.target.closest('[data-record-id]'); if (!button) return; selectedRecordId = button.dataset.recordId; renderRecords(); renderDetail(); });
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { selectedFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(peer => peer.setAttribute('aria-pressed', String(peer === button))); renderRecords(); renderDetail(); }));
$('export').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([JSON.stringify({synthetic:true, asof:state.asof, records:state.records}, null, 2)], {type:'application/json'})); const link = document.createElement('a'); link.href = url; link.download = 'buyer-research.fake.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
loadState();
