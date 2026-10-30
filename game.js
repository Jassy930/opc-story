// 表现层：canvas 像素办公室 + 右侧面板。逻辑全在 sim.js（这里只调用 SIM.*）。
// 注意：浏览器里三个脚本共享全局作用域，别在这里重复声明 sim.js 的顶层名字。
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const $ = id => document.getElementById(id);
const money = n => '¥' + Math.round(n).toLocaleString();
const TYPE_COLOR = { code: '#5bc0eb', content: '#f78fb3', service: '#7bd389' };

let G = null, lastRun = null, frame = 0, particles = [], modalOpen = false;
const SAVE_KEY = "opc-save";

// ---------- 像素精灵：字符 → 颜色，'.' 透明 ----------
const ROBOT = [
  '....a....',
  '....k....',
  '.kkkkkkk.',
  '.kbbbbbk.',
  '.kbebebk.',
  '.kbbbbbk.',
  '.kbbmbbk.',
  '.kkkkkkk.',
  'kkbbbbbkk',
  'kbbbbbbbk',
  'kbbbbbbbk',
];
const BOSS = [
  '..hhhhh..',
  '.hhhhhhh.',
  '.hsssssh.',
  '.sksssks.',
  '..ssmss..',
  '...sss...',
  '.ttttttt.',
  'ttttttttt',
  'ttttttttt',
];

function sprite(rows, x, y, pal, k = 2) {
  rows.forEach((r, j) => [...r].forEach((c, i) => {
    if (c === '.') return;
    ctx.fillStyle = pal[c];
    ctx.fillRect(x + i * k, y + j * k, k, k);
  }));
}
const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

// 8 个工位：2 行 × 4 列
const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: 22 + (i % 4) * 56, y: 78 + Math.floor(i / 4) * 52 }));

function drawDesk(x, y, agent) {
  const busy = agent && agent.busy;
  if (agent) {
    const m = SIM.getModel(G, agent.modelId);
    const bob = busy && frame % 4 < 2 ? 1 : 0;
    sprite(ROBOT, x + 6, y - 24 + bob, {
      k: '#1b1830', b: m ? m.color : '#888', m: '#1b1830',
      e: busy ? '#9ff6ff' : '#f4ecd8', a: busy && frame % 6 < 3 ? '#ff6b6b' : '#777',
    });
  }
  // 桌子
  rect(x - 2, y - 2, 34, 3, '#a8744f');
  rect(x - 2, y + 1, 34, 10, '#7a4e2f');
  rect(x, y + 11, 2, 4, '#4d2f1b');
  rect(x + 28, y + 11, 2, 4, '#4d2f1b');
  // 笔记本背面，工作时发光
  rect(x + 9, y - 8, 12, 7, "#b9b4c7");
  rect(x + 14, y - 6, 2, 2, busy ? '#9ff6ff' : '#6e6a80');
  // 咖啡杯
  rect(x + 26, y - 4, 3, 3, '#f4ecd8');
  // 名牌
  ctx.font = '5px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = agent ? '#f4ecd8' : '#8a7a68';
  ctx.fillText(agent ? `${agent.name} Lv${agent.level}` : '空工位', x + 15, y + 21);
}

function drawScene() {
  ctx.setTransform(3, 0, 0, 3, 0, 0);
  // 墙
  rect(0, 0, 320, 52, '#3b3561');
  rect(0, 50, 320, 3, '#241f3d');
  // 窗户 + 飘动的云
  for (const wx of [14, 66]) {
    rect(wx, 10, 40, 26, '#241f3d');
    rect(wx + 2, 12, 36, 22, G.day % 30 < 25 ? '#8fd3ff' : '#2d3a7a');
    const cx = wx + 2 + ((frame / 3 + wx) % 36);
    rect(Math.min(cx, wx + 30), 18, 8, 3, '#ffffff');
    rect(wx + 19, 12, 2, 22, '#241f3d');
  }
  // 白板：现金曲线
  rect(124, 6, 90, 38, '#e8e4f0');
  rect(124, 42, 90, 2, '#9a93b8');
  if (G.hist.length > 1) {
    const max = Math.max(...G.hist), min = Math.min(0, ...G.hist);
    G.hist.forEach((v, i) => {
      const px = 128 + Math.floor(i * 82 / Math.max(G.hist.length - 1, 1));
      const py = 38 - Math.floor((v - min) / (max - min || 1) * 28);
      rect(px, py, 1, 1, v < G.hist[i - 1] ? '#e05a5a' : '#2f9e5b');
    });
  }
  ctx.font = '5px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3b3561';
  ctx.fillText('CASH', 127, 12);
  // 海报
  rect(226, 12, 22, 28, '#ffd166');
  ctx.fillStyle = '#3b3561';
  ctx.fillText('OPC', 229, 28);
  // 地板棋盘格
  for (let y = 53; y < 180; y += 16) for (let x = 0; x < 320; x += 16) {
    rect(x, y, 16, 16, ((x + y) / 16) % 2 < 1 ? '#c8a77e' : '#bf9c72');
  }
  // 服务器机柜：越多 agent 在干活，灯越闪
  const busyN = G.agents.filter(a => a.busy).length;
  rect(290, 24, 22, 56, '#2a2a35');
  for (let i = 0; i < 6; i++) {
    rect(292, 27 + i * 9, 18, 7, '#3d3d4d');
    rect(295, 30 + i * 9, 2, 2, Math.random() < busyN / 8 ? '#7bd389' : '#1f4d2e');
    rect(299, 30 + i * 9, 2, 2, Math.random() < busyN / 10 ? '#ffd166' : '#4d3f1f');
  }
  // 绿植
  rect(4, 150, 10, 10, '#a0522d');
  rect(2, 138, 14, 12, '#3f9e4d');
  rect(5, 134, 8, 6, '#58c26a');

  SLOTS.forEach((p, i) => drawDesk(p.x, p.y, G.agents[i]));

  // 老板（你）
  const bx = 262, by = 132;
  sprite(BOSS, bx + 14, by - 20, { h: '#3a2a1a', s: '#f2c29b', k: '#222', m: '#c46a5a', t: '#e04f5f' });
  rect(bx - 4, by - 2, 38, 3, '#a8744f');
  rect(bx - 4, by + 1, 38, 12, '#5e3a22');
  rect(bx, by - 10, 12, 8, '#1b1830');
  rect(bx + 1, by - 9, 10, 6, '#ffd166');
  ctx.font = '5px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('你 (CEO)', bx + 15, by + 21);

  // 粒子：金币（烧 token）/ 文字（交付、事件）
  particles = particles.filter(p => p.life-- > 0);
  for (const p of particles) {
    p.y += p.vy;
    if (p.text) {
      ctx.font = 'bold 7px "PingFang SC", sans-serif';
      ctx.fillStyle = p.c;
      ctx.fillText(p.text, p.x, p.y);
    } else rect(Math.round(p.x), Math.round(p.y), 2, 2, p.c);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- 面板 ----------
function renderPanel() {
  const burn = G.agents.filter(a => a.busy).reduce((t, a) => t + SIM.dailyCost(G, a), 0);
  $('stats').innerHTML = [
    `📅 第 <b>${G.day}</b> 天（第 ${Math.floor(G.day / 30) + 1} 月）`,
    `💰 现金 <b class="${G.cash < 10000 ? 'bad' : ''}">${money(G.cash)}</b>${G.cash < 0 ? ` <span class="bad">透支中！额度 ${money(SIM.CREDIT)}</span>` : ''}`,
    `⭐ 声誉 <b>${G.rep}</b>`,
    `⚡ 精力 <b class="${G.energy < SIM.TIRED ? 'bad' : ''}">${G.energy}</b>`,
    `🔁 月订阅 <b>${money(G.mrr)}</b>`,
    `🔥 今日 token <b>${money(burn)}</b>`,
    `🧾 本月 token <b>${money(G.month.token)}</b>`,
    `🎯 目标 ${money(SIM.GOAL)}（${(G.cash / SIM.GOAL * 100).toFixed(1)}%）`,
  ].map(x => `<span>${x}</span>`).join('');

  $('mode').innerHTML = Object.entries(SIM.MODES).map(([k, m]) =>
    `<button data-act="mode" data-v="${k}" class="${G.mode === k ? 'on' : ''}" title="token ×${m.tok} / 产出 ×${m.work}">${m.name}</button>`).join(' ');
  $('actions').innerHTML = Object.entries(SIM.D.actions).map(([k, a]) =>
    `<button data-act="action" data-v="${k}" class="${G.action === k ? 'on' : ''}" title="${a.desc}" ${G.energy + a.energy < 0 ? 'disabled' : ''}>` +
    `${a.name} <small>${a.energy > 0 ? '+' : ''}${a.energy}</small></button>`).join(' ') +
    `<div class="dim">${SIM.D.actions[G.action].desc}（会一直保持，直到你换别的；精力不够时自动改为日常管理）</div>`;
  $('next').disabled = $('fast').disabled = !!G.over || !!G.pending;
  $('autos').innerHTML = [['accept', '自动接单', '只接团队质量够、排期做得完的单'], ['rest', '低精力自动休息', '精力 < 30 时当天改为休息']]
    .map(([k, name, tip]) => `<label title="${tip}"><input type="checkbox" data-auto="${k}" ${G.auto[k] ? 'checked' : ''}> ${name}</label>`).join('　');
  $('report').innerHTML = G.report
    ? (lastRun ? `<div class="good">⏩ 连续推进 ${lastRun.days} 天，停下原因：${lastRun.reason}</div>` : '') +
      `<b>第 ${G.report.day} 天</b>　<span class="good">收入 ${money(G.report.income)}</span>　<span class="bad">token ${money(G.report.token)}</span>` +
      [...G.report.work, ...G.report.lines].map(t => `<div>${t}</div>`).join('')
    : '<span class="dim">新公司开张。接几个单子、配好模型，然后点「下一天」。</span>';

  // 正在操作下拉框时别重绘 agent 区，否则下拉会被关掉
  if (document.activeElement?.tagName !== "SELECT" || !$("agents").contains(document.activeElement)) {
    const cost = SIM.hireCost(G);
    $('agents').innerHTML = `<h3>Agent 团队（${G.agents.length}/${SIM.MAX_AGENTS}）</h3>
      <div class="row">招募
        <select id="hireRole">${Object.entries(SIM.D.roles).map(([k, r]) => `<option value="${k}">${r.name} Agent</option>`).join('')}</select>
        <button data-act="hire" ${G.cash < cost || G.agents.length >= SIM.MAX_AGENTS ? 'disabled' : ''}>招募 ${money(cost)}</button>
      </div>` +
      G.agents.map(a => {
        const p = G.projects.find(p => p.id === a.busy);
        return `<div class="row">
          <div class="grow"><b>${a.name}</b> <span class="dim">Lv${a.level}${a.level < 5 ? ` (${a.xp}/${a.level * 10})` : ''} ${SIM.D.roles[a.role].name}</span><br>
            <span class="dim">${p ? `▶ ${p.name} · 烧 ${money(SIM.dailyCost(G, a))}/天` : '💤 空闲（不耗 token）'}</span></div>
          <div style="display:flex;flex-direction:column;gap:2px">
            <select data-agent="${a.id}" title="使用的模型">${G.models.map(m =>
              `<option value="${m.id}" ${m.id === a.modelId ? 'selected' : ''}>🧠 ${m.name}</option>`).join('')}</select>
            <select data-target="${a.id}" title="指派项目"><option value="">📌 自动分配</option>${G.projects.map(p =>
              `<option value="${p.id}" ${p.id === a.target ? 'selected' : ''}>📌 ${p.name}</option>`).join('')}</select>
          </div>
          <button data-act="fire" data-id="${a.id}" title="下线">✕</button>
        </div>`;
      }).join('');
  }

  $('projects').innerHTML = `<h3>进行中项目（${G.projects.length}）</h3>` + (G.projects.map(p => {
    const q = p.done ? p.qsum / p.done : 0, left = p.deadline - G.day;
    return `<div class="row"><div class="grow">
      <span class="tag" style="color:${TYPE_COLOR[p.type]}">${SIM.D.types[p.type].name}</span> ${p.name}
      <span class="dim">· ${money(p.reward)}</span>
      <span class="${left < 5 ? 'bad' : 'dim'}" style="float:right">剩 ${left} 天</span>
      <div class="bar"><i style="width:${Math.min(100, p.done / p.work * 100)}%"></i></div>
      <span class="dim">进度 ${Math.floor(p.done)}/${p.work} · 质量 <span class="${q && q < p.minQ ? 'bad' : ''}">${Math.round(q * 100)}%</span> / 要求 ${Math.round(p.minQ * 100)}%</span>
    </div></div>`;
  }).join('') || '<div class="dim">没有项目，agent 都在摸鱼。去订单板接单吧。</div>');

  $('offers').innerHTML = `<h3>订单板</h3>` + (G.offers.map(o => `<div class="row"><div class="grow">
      <span class="tag" style="color:${TYPE_COLOR[o.type]}">${SIM.D.types[o.type].name}</span> ${o.name} <b>${money(o.reward)}</b><br>
      <span class="dim">工作量 ${o.work} · 质量要求 ${Math.round(o.minQ * 100)}% · 工期 ${o.days} 天 · ${o.expires - G.day} 天后过期</span>
    </div><button data-act="accept" data-id="${o.id}">接单</button></div>`).join('') || '<div class="dim">暂时没有新订单……</div>');

  $('market').innerHTML = `<h3>模型市场</h3><table>
    <tr class="dim"><th>模型</th><th>厂商</th><th>¥/百万token</th><th>产出</th><th>质量</th></tr>` +
    G.models.map(m => `<tr><td style="color:${m.color}">■ ${m.name}</td><td>${m.vendor}</td><td>${+SIM.priceOf(G, m).toFixed(1)}${m.discountUntil >= G.day ? ' <span class="good">套餐5折</span>' : ''}</td><td>${m.power}</td><td>${Math.round(m.quality * 100)}%</td></tr>`).join('') +
    `</table><div class="dim">换模型需付迁移费 ${money(SIM.SWITCH_FEE)}。老模型会下线，新模型会不定期发布。</div>`;

  $('upgrades').innerHTML = '<h3>公司升级</h3>' + SIM.D.upgrades.map(u => `<div class="row"><div class="grow">
      <b>${u.name}</b><br><span class="dim">${u.desc}</span></div>` +
    (G.upgrades.includes(u.id) ? '<span class="good">✔ 已拥有</span>'
      : `<button data-act="buy" data-id="${u.id}" ${G.cash < u.cost ? 'disabled' : ''}>${money(u.cost)}</button>`) + '</div>').join('');

  $('log').innerHTML = G.log.map(l => `<div><span class="dim">D${l.day}</span> ${l.text}</div>`).join('');
}

// ---------- 弹窗 ----------
function modal(html) { $('modalBody').innerHTML = html; $('modal').style.display = 'flex'; modalOpen = true; }
function closeModal() { $('modal').style.display = 'none'; $('modalBody').innerHTML = ''; modalOpen = false; }

function showStart() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {} // 坏存档当作没有
  if (saved?.v !== SIM.SAVE_V) saved = null;
  modal(`<h2>OPC 一人公司物语</h2>
    <p>你辞职了，决定一个人带着一群 AI agent 开公司。<br>接单赚钱，控制 token 成本，跟上模型迭代，目标：现金 ${money(SIM.GOAL)}。</p>` +
    (saved && !saved.over ? `<button class="card" data-act="load"><b>▶ 继续上局</b>　第 ${saved.day} 天 · 现金 ${money(saved.cash)}</button>` : '') +
    `<p>选一个公司方向开新局：</p>` +
    SIM.D.directions.map(d => `<button class="card" data-act="start" data-id="${d.id}">
      <b>${d.name}</b>　启动资金 ${money(d.cash)}<br><span class="dim">${d.desc}</span></button>`).join(''));
}

function showPopups() {
  if (!G.popups.length) return;
  const texts = G.popups.splice(0);
  modal(`<h2>${{ win: '🏆 胜利', lose: '💸 破产', sold: '🤝 收购结局', hired: '💼 打工人结局' }[G.over] || '📢 行业快讯'}</h2>` +
    texts.map(t => `<p>${t}</p>`).join('') +
    (G.over
      ? `<p class="dim">共经营 ${G.day} 天，声誉 ${G.rep}，团队 ${G.agents.length} 个 agent。<br>` +
        `累计项目收入 ${money(G.total.income)}，烧掉 token ${money(G.total.token)}，固定开销 ${money(G.total.fixed)}。</p><button data-act="restart">再来一局</button>`
      : '<button data-act="close">继续经营</button>'));
}

// 抉择事件：只能选一个选项来关闭
function showPending() {
  const v = !modalOpen && SIM.pendingView(G);
  if (!v) return;
  modal(`<h2>🤔 抉择时刻</h2><p>${v.text}</p>` +
    v.options.map((o, i) => `<button class="card" data-act="choose" data-i="${i}">${o}</button>`).join(''));
}

const save = () => G.over ? localStorage.removeItem(SAVE_KEY) : localStorage.setItem(SAVE_KEY, JSON.stringify(G));

// ---------- 推进（玩家点击才会走）：fast = 一直推进到有事发生 ----------
function nextDay(fast = false) {
  if (!G || G.over || G.pending || modalOpen) return;
  const last = G.log[0];
  lastRun = fast ? SIM.runUntil(G, 30) : null;
  if (!fast) SIM.tick(G);
  // 金币从干活的 agent 头上冒出来 = 今天烧掉的 token
  G.agents.forEach((a, i) => {
    if (!a.busy) return;
    for (let k = 0; k < 5; k++) particles.push({ x: SLOTS[i].x + 10 + Math.random() * 12, y: SLOTS[i].y - 26 - k * 3, vy: -0.4, life: 16 + k * 3, c: '#ffd166' });
  });
  let n = 0; // 同一天多条提示往上错开，避免叠字
  for (const l of G.log) {
    if (l === last) break;
    if (n > 4) break;
    const y = 110 - 9 * n++;
    if (l.text.startsWith('✅')) particles.push({ x: 277, y, vy: -0.5, life: 30, c: '#7bd389', text: '交付！+¥' });
    if (l.text.startsWith('❌')) particles.push({ x: 277, y, vy: -0.5, life: 30, c: '#ff6b6b', text: '逾期…' });
    if (l.text.startsWith('📰')) particles.push({ x: 277, y, vy: -0.4, life: 30, c: '#ffd166', text: '突发！' });
  }
  save();
  renderPanel();
  showPopups();
  showPending();
}

// ---------- 交互 ----------
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  b.blur(); // 防止之后按空格时重复触发这个按钮
  const id = +b.dataset.id;
  switch (b.dataset.act) {
    case 'start': G = SIM.newGame(b.dataset.id); closeModal(); break;
    case 'load': G = JSON.parse(localStorage.getItem(SAVE_KEY)); closeModal(); renderPanel(); showPending(); return;
    case 'restart': showStart(); return;
    case 'close': closeModal(); showPending(); break;
    case 'choose': SIM.choose(G, +b.dataset.i); closeModal(); save(); renderPanel(); showPopups(); return;
    case 'action': SIM.setAction(G, b.dataset.v); break;
    case 'buy': SIM.buy(G, b.dataset.id); break;
    case 'next': nextDay(); return;
    case 'fast': nextDay(true); return;
    case 'mode': SIM.setMode(G, b.dataset.v); break;
    case 'accept': SIM.accept(G, id); break;
    case 'hire': SIM.hire(G, $('hireRole').value); break;
    case 'fire': if (confirm('确定下线这个 agent？')) SIM.fire(G, id); break;
  }
  if (G) { save(); renderPanel(); }
});

document.addEventListener('change', e => {
  const d = e.target.dataset;
  if (d.agent) SIM.setModel(G, +d.agent, e.target.value);
  else if (d.auto) SIM.setAuto(G, d.auto, e.target.checked);
  else if (d.target) SIM.setTarget(G, +d.target, e.target.value ? +e.target.value : null);
  else return;
  e.target.blur();
  save();
  renderPanel();
});

document.addEventListener('keydown', e => {
  if (!['Space', 'KeyF'].includes(e.code) || /SELECT|INPUT|BUTTON/.test(document.activeElement.tagName)) return;
  e.preventDefault();
  nextDay(e.code === 'KeyF');
});

// 只负责动画（机器人晃动、指示灯、粒子），不推进游戏时间
setInterval(() => { if (G) { frame++; drawScene(); } }, 100);

showStart();
