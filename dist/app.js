const labels = {explicit:'明确需求', opportunity:'采购机会', pending:'待核验'};
const statuses = {queued:'待执行', completed:'演示完成', cancelled:'已取消', interrupted:'中断，待人工处理'};
const gaps = {identity_verified:'企业身份', product_match:'产品匹配', contact_verified:'联系证据', source_matched:'来源原文', publication_date:'日期有效性', expired_demand:'需求已截止', demand_evidence:'采购需求'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = {records:[],tasks:[],paused:false};
let selected = 'all';
let requestId = crypto.randomUUID();
let busy = false;
const $ = id => document.getElementById(id);

async function send(path, payload) {
  const response = await fetch(path, payload ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)} : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '本地服务未就绪');
  state = data;
  render();
}

function render() {
  $('counts').innerHTML = Object.entries(labels).map(([key,label]) => `<div class="count"><strong>${state.records.filter(r => r.category === key).length}</strong>${label} · 合成记录</div>`).join('');
  const records = state.records.filter(r => selected === 'all' || r.category === selected);
  $('records').innerHTML = records.map(r => `<article class="record"><span class="tag ${esc(r.category)}">${labels[r.category]}</span><h3>${esc(r.name)}</h3><p>${esc(r.next_action)}</p><details><summary>查看原文与核验缺口</summary><blockquote>${esc(r.quote)}</blockquote><dl><dt>样例来源</dt><dd>${esc(r.source)}</dd><dt>发布 / 截止</dt><dd>${esc(r.published_on)} / ${esc(r.closes_on || '未知')}</dd><dt>证据缺口</dt><dd>${r.gaps.length ? r.gaps.map(g => gaps[g] || g).join('、') : '样例核验项齐全'}</dd><dt>采购权限</dt><dd>未知，不随分类升级</dd></dl></details></article>`).join('') || '<p class="empty">此分类没有合成记录。</p>';
  $('queueState').textContent = state.paused ? '队列已暂停，不领取任务。' : '队列可处理，点击按钮完成下一条离线任务。';
  $('pause').disabled = busy || state.paused;
  $('resume').disabled = busy || !state.paused;
  $('next').disabled = busy || state.paused || !state.tasks.some(t => t.status === 'queued');
  $('enqueue').disabled = busy;
  $('tasks').innerHTML = state.tasks.map(t => `<div class="task"><div>${esc(t.product)}<small>DEMO-${t.id} · ${statuses[t.status] || esc(t.status)}</small></div>${t.status === 'queued' ? `<button data-cancel="${t.id}" ${busy ? 'disabled' : ''}>取消排队</button>` : ''}</div>`).join('') || '<p class="empty">暂无任务。创建一个任务，体验保存、暂停和处理。</p>';
}

async function action(path, payload) {
  if (busy) return false;
  busy = true; render();
  $('message').textContent = '';
  try { await send(path,payload); return true; }
  catch(error) { $('message').textContent = error.message; return false; }
  finally { busy = false; render(); }
}

$('form').addEventListener('submit', async event => {
  event.preventDefault();
  if (await action('/api/enqueue', {product:$('product').value,request_id:requestId})) {
    requestId = crypto.randomUUID();
    $('message').textContent = '演示任务已保存。结果固定，不代表实际搜索。';
  }
});
$('product').addEventListener('input', () => { requestId = crypto.randomUUID(); });
for (const [id,path] of [['pause','pause'],['resume','resume'],['next','next']]) {
  $(id).addEventListener('click', () => action(`/api/${path}`, {}));
}
$('tasks').addEventListener('click', event => {
  if (event.target.dataset.cancel) action('/api/cancel', {id:Number(event.target.dataset.cancel)});
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  selected = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  render();
}));
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({synthetic:true,asof:state.asof,records:state.records},null,2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'buyer-research.fake.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
send('/api/state').catch(error => { $('message').textContent = error.message; });
