// 纯逻辑层：无 DOM。浏览器里作为普通 <script> 加载，bun test 里 require。
// 回合制：玩家每点一次「下一天」调用一次 tick()；有待选事件 (s.pending) 时必须先 choose()。
const D = typeof module !== 'undefined' ? require('./data.js') : DATA;

const TOKENS_PER_DAY = 12;       // 每个工作中的 agent 每天消耗的百万 token（标准模式）
const RENT = 3000;               // 月租 + 订阅
const UPKEEP = 800;              // 每个 agent 每月的部署/运维费
const SWITCH_FEE = 500;          // 换模型的迁移费（提示词重调）
const GOAL = 1000000;            // 现金达到即胜利
const MAX_AGENTS = 8;            // 办公室工位数
const SAVE_V = 3;                // 存档格式版本，状态结构变了就 +1，旧存档自动作废
const REWARD_PER_WORK = 150;     // 每单位工作量的基础报酬（质量要求 0.7 时）
const CREDIT = 20000;            // 透支额度：现金跌破 -CREDIT 才破产
const INTEREST = 0.005;          // 透支日息
const TIRED = 20;                // 精力低于此值，CEO 疲惫：全员质量 -5%
const MODES = {
  eco: { name: '省钱', tok: 0.5, work: 0.75, q: -0.05 },   // 现金紧张时降低日烧钱
  normal: { name: '标准', tok: 1, work: 1, q: 0 },
  turbo: { name: '深度思考', tok: 2.2, work: 1.3, q: 0.05 }, // 赶工期/冲质量用，常开不划算
};

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const getModel = (s, id) => s.models.find(m => m.id === id);
const hireCost = s => 5000 + 3000 * s.agents.length;
const yuan = n => '¥' + Math.round(n).toLocaleString();

// 已购升级的合计效果
function boosts(s) {
  const b = { work: 1, tok: 1, q: 0, lead: 1, guard: [] };
  for (const u of D.upgrades) {
    if (!s.upgrades.includes(u.id)) continue;
    b.work *= u.work || 1; b.tok *= u.tok || 1; b.lead *= u.lead || 1; b.q += u.q || 0;
    if (u.guard) b.guard.push(u.guard);
  }
  return b;
}

// 含年付套餐折扣的单价
const priceOf = (s, m) => m.price * (m.discountUntil >= s.day ? 0.5 : 1);
const dailyCost = (s, a) => TOKENS_PER_DAY * MODES[s.mode].tok * boosts(s).tok * priceOf(s, getModel(s, a.modelId));

function log(s, text, popup = false) {
  s.log.unshift({ day: s.day, text });
  s.log.length = Math.min(s.log.length, 60);
  if (s.report) s.report.lines.push(text);
  if (popup) s.popups.push(text);
}

function newGame(dirId, rand = Math.random) {
  const dir = D.directions.find(d => d.id === dirId);
  const s = {
    v: SAVE_V, day: 0, dir: dir.id, cash: dir.cash, rep: 10, mrr: 0, mode: 'normal', throttle: 0,
    energy: 100, action: 'manage', upgrades: [], extraFixed: 0, pending: null, soldFor: 0,
    auto: { accept: false, rest: false }, total: { income: 0, token: 0, fixed: 0 },
    models: D.models.filter(m => m.release === 0).map(m => ({ ...m })),
    agents: [], offers: [], projects: [], log: [], popups: [], nextId: 1,
    month: { income: 0, token: 0 }, over: null, hist: [dir.cash], report: null,
  };
  makeAgent(s, dir.role, 'cs35', rand);
  for (let i = 0; i < 3; i++) s.offers.push(makeOffer(s, rand));
  log(s, `「${dir.name}」成立了！你和你的第一个 agent 开始创业。`);
  return s;
}

function makeAgent(s, role, modelId, rand) {
  const used = new Set(s.agents.map(a => a.name));
  const name = D.agentNames.find(n => !used.has(n) && rand() < 0.5) || D.agentNames.find(n => !used.has(n)) || `Agent${s.nextId}`;
  const a = { id: s.nextId++, name, role, modelId, level: 1, xp: 0, busy: null, target: null };
  s.agents.push(a);
  return a;
}

function makeOffer(s, rand, bonus = 1) {
  const mix = D.directions.find(d => d.id === s.dir).mix;
  let r = rand(), type = 'code';
  for (const [t, w] of Object.entries(mix)) { if ((r -= w) < 0) { type = t; break; } }
  const T = D.types[type];
  const work = Math.round(T.min + rand() * (T.max - T.min));
  const minQ = Math.round((0.5 + rand() * 0.35 + work / 1000) * 100) / 100;
  return {
    id: s.nextId++, type, name: pick(T.names, rand), work, minQ,
    // 质量要求越高越值钱：高要求单才养得起贵模型
    reward: Math.round(work * REWARD_PER_WORK * (T.pay || 1) * (minQ / 0.7) ** 2 * (1 + s.rep / 200) * (0.8 + rand() * 0.4) * bonus / 100) * 100,
    days: Math.ceil(work / 2.5) + 10,
    expires: s.day + 15,
  };
}

function gainXp(s, a, n) {
  a.xp += n;
  while (a.level < 5 && a.xp >= a.level * 10) {
    a.xp -= a.level * 10;
    a.level++;
    log(s, `⬆️「${a.name}」升到 Lv${a.level}`);
  }
}

// ---- 玩家操作：成功返回 true，失败写日志返回 false ----

function accept(s, offerId) {
  const i = s.offers.findIndex(o => o.id === offerId);
  if (i < 0) return false;
  const o = s.offers.splice(i, 1)[0];
  s.projects.push({ ...o, deadline: s.day + o.days, done: 0, qsum: 0, crew: [] });
  return true;
}

function hire(s, role, rand = Math.random) {
  if (s.agents.length >= MAX_AGENTS) return log(s, '工位已满，没法再加 agent 了。'), false;
  const cost = hireCost(s);
  if (s.cash < cost) return log(s, `招募需要 ${yuan(cost)}，现金不足。`), false;
  s.cash -= cost;
  const a = makeAgent(s, role, (s.agents[0] || {}).modelId || s.models[0].id, rand);
  log(s, `新 agent「${a.name}」(${D.roles[role].name}) 上岗，花费 ${yuan(cost)}。`);
  return true;
}

function fire(s, agentId) {
  const i = s.agents.findIndex(a => a.id === agentId);
  if (i < 0) return false;
  log(s, `「${s.agents[i].name}」被下线了。`);
  s.agents.splice(i, 1);
  return true;
}

function setModel(s, agentId, modelId) {
  const a = s.agents.find(a => a.id === agentId);
  if (!a || !getModel(s, modelId) || a.modelId === modelId) return false;
  if (s.cash < SWITCH_FEE) return log(s, '现金不足以支付迁移费。'), false;
  s.cash -= SWITCH_FEE;
  a.modelId = modelId;
  log(s, `「${a.name}」切换到 ${getModel(s, modelId).name}（迁移费 ${yuan(SWITCH_FEE)}）。`);
  return true;
}

// projectId 为 null 表示自动分配
function setTarget(s, agentId, projectId) {
  const a = s.agents.find(a => a.id === agentId);
  if (!a) return false;
  a.target = s.projects.some(p => p.id === projectId) ? projectId : null;
  return true;
}

function buy(s, upId) {
  const u = D.upgrades.find(u => u.id === upId);
  if (!u || s.upgrades.includes(upId)) return false;
  if (s.cash < u.cost) return log(s, `「${u.name}」需要 ${yuan(u.cost)}，现金不足。`), false;
  s.cash -= u.cost;
  s.upgrades.push(upId);
  log(s, `🛠️ 购入「${u.name}」：${u.desc}`);
  return true;
}

function setMode(s, mode) { if (MODES[mode]) s.mode = mode; }
function setAction(s, act) { if (D.actions[act]) s.action = act; }

// ---- 资讯事件（自动生效）。guard: 买了对应升级就免疫 ----

const NEWS = [
  { w: 3, run: s => { s.rep += 5; return '你的一条「一人公司日赚过万」推文爆了，声誉 +5'; } },
  { w: 3, run: s => { s.cash -= 2000; return '云服务器宕机，紧急修复花费 ¥2,000'; } },
  { w: 3, guard: 'hallu', run: s => {
      const p = s.projects[0]; if (!p) return null;
      p.done *= 0.8; s.rep -= 3;
      return `Agent 幻觉事故！「${p.name}」里编造了不存在的 API，进度 -20%，声誉 -3`;
    } },
  { w: 2, guard: 'ops', run: s => { s.cash -= 3000; return '遭遇提示词注入攻击，API 账单被刷了 ¥3,000'; } },
  { w: 3, run: s => { s.rep += 4; return '公司开源的小工具拿到 1k star，声誉 +4'; } },
  { w: 2, run: s => { s.throttle = 5; return '上游 API 限流 5 天，所有 agent 产出减半'; } },
  { w: 2, run: (s, rand) => {
      const m = pick(s.models, rand); m.price = Math.round(m.price * 0.6 * 10) / 10;
      return `价格战！${m.vendor} 宣布 ${m.name} 降价 40%（现 ¥${m.price}/M）`;
    } },
  { w: 2, run: (s, rand) => {
      const m = pick(s.models, rand); m.price = Math.round(m.price * 1.3 * 10) / 10;
      return `算力紧张，${m.name} 涨价 30%（现 ¥${m.price}/M）`;
    } },
  { w: 1, run: (s, rand) => {
      const m = pick(s.models, rand); m.price = Math.round(m.price * 0.8 * 10) / 10;
      return `${m.name} 被曝评测刷榜，口碑下滑，被迫降价 20%（现 ¥${m.price}/M）`;
    } },
  { w: 3, run: (s, rand) => { s.offers.push(makeOffer(s, rand, 1.6)); return '老客户介绍了一个高价单子，快去看看！'; } },
  { w: 2, guard: 'ops', run: s => {
      if (!s.agents.length) return null;
      const x = 500 * s.agents.length; s.cash -= x;
      return `某个 agent 陷入死循环，一夜烧掉 ${yuan(x)} 的 token`;
    } },
  { w: 2, run: s => { s.agents.forEach(a => gainXp(s, a, 5)); return '开源社区发布了新 agent 框架，全员经验 +5'; } },
  { w: 1, run: s => { s.cash -= 5000; return '监管新规：AI 生成内容必须标注，合规整改花费 ¥5,000'; } },
  { w: 2, run: s => { s.rep += 6; return '受邀在 AI 峰会分享「一个人 + 一群 agent」，声誉 +6'; } },
  { w: 2, run: s => { s.rep += 3; return '客户在社交媒体夸你的交付质量，声誉 +3'; } },
];

// ---- 抉择事件：弹窗让玩家选。ctx 只存 id/数字，保证存档可 JSON 序列化 ----

const proj = (s, ctx) => s.projects.find(p => p.id === ctx.pid);
const nextModel = s => D.models.find(m => m.release > s.day && m.release <= s.day + 20 && !getModel(s, m.id));

const CHOICES = {
  rush: {
    w: 3, cond: s => s.projects.length > 0,
    init: (s, rand) => ({ pid: pick(s.projects, rand).id }),
    text: (s, c) => `客户「${proj(s, c).name}」急着上线，希望提前 5 天交付（当前剩 ${proj(s, c).deadline - s.day} 天），愿意多付 30%。`,
    options: [
      { label: '接下挑战（工期 -5 天，报酬 +30%）', run: (s, c) => { const p = proj(s, c); p.deadline -= 5; p.reward = Math.round(p.reward * 1.3); } },
      { label: '婉拒，按原计划', run: () => {} },
    ],
  },
  scope: {
    w: 3, cond: s => s.projects.length > 0,
    init: (s, rand) => ({ pid: pick(s.projects, rand).id }),
    text: (s, c) => `「${proj(s, c).name}」的客户中途改需求，工作量要增加 30%。`,
    options: [
      { label: '加钱就改（工作量 +30%，报酬 +20%）', run: (s, c) => { const p = proj(s, c); p.work = Math.round(p.work * 1.3); p.reward = Math.round(p.reward * 1.2); } },
      { label: '免费改，留个好印象（声誉 +3）', run: (s, c) => { proj(s, c).work = Math.round(proj(s, c).work * 1.3); s.rep += 3; } },
      { label: '按合同来，拒绝（声誉 -3）', run: s => { s.rep -= 3; } },
    ],
  },
  poach: {
    w: 2, cond: s => s.projects.length > 0,
    init: (s, rand) => ({ pid: pick(s.projects, rand).id }),
    text: (s, c) => `竞争对手用纯开源模型报了低价，想抢走「${proj(s, c).name}」。`,
    options: [
      { label: '降价 20% 保住客户', run: (s, c) => { proj(s, c).reward = Math.round(proj(s, c).reward * 0.8); } },
      { label: '放手（项目取消，声誉 -2）', run: (s, c) => { s.projects = s.projects.filter(p => p.id !== c.pid); s.rep -= 2; } },
    ],
  },
  buyout: {
    w: 2, cond: s => s.day > 20,
    init: () => ({}),
    text: () => '某大厂想买断你攒下的 Prompt 库，出价 ¥20,000。同行可能会笑你「卖祖传秘方」。',
    options: [
      { label: '卖！（+¥20,000，声誉 -3）', run: s => { s.cash += 20000; s.rep -= 3; } },
      { label: '不卖，这是核心资产', run: () => {} },
    ],
  },
  investor: {
    w: 2, cond: s => s.rep >= 25 && s.extraFixed < 3000,
    init: () => ({}),
    text: () => '一位投资人愿意注资 ¥50,000，条件是每月要做正式汇报（固定开销 +¥1,500/月）。',
    options: [
      { label: '接受注资', run: s => { s.cash += 50000; s.extraFixed += 1500; } },
      { label: '保持独立', run: () => {} },
    ],
  },
  leak: {
    w: 2, cond: s => s.agents.length > 0,
    init: (s, rand) => ({ aid: pick(s.agents, rand).id }),
    text: (s, c) => `糟了！「${(s.agents.find(a => a.id === c.aid) || { name: '某 agent' }).name}」把客户数据贴进了一个公开 issue。`,
    options: [
      { label: '公开道歉（声誉 -5）', run: s => { s.rep -= 5; } },
      { label: '花钱找公关（-¥8,000）', run: s => { s.cash -= 8000; } },
      { label: '装没看见（50% 没事，50% 声誉 -15）', run: (s, c, rand) => { if (rand() < 0.5) { s.rep -= 15; log(s, '事情还是被扒出来了，声誉 -15'); } else log(s, '……好像没人注意到。'); } },
    ],
  },
  sponsor: {
    w: 2, cond: s => s.cash > 20000,
    init: () => ({}),
    text: () => '一个热门开源模型社区来拉赞助：¥5,000，会在 README 里挂你的 logo。',
    options: [
      { label: '赞助（-¥5,000，声誉 +6）', run: s => { s.cash -= 5000; s.rep += 6; } },
      { label: '下次一定', run: () => {} },
    ],
  },
  hackathon: {
    w: 2, cond: s => s.energy >= 30,
    init: () => ({}),
    text: () => 'AI 黑客松邀请你参赛，要熬两个通宵（精力 -30）。',
    options: [
      { label: '参加（声誉 +4，40% 拿 ¥15,000 奖金）', run: (s, c, rand) => {
          s.energy -= 30; s.rep += 4;
          if (rand() < 0.4) { s.cash += 15000; log(s, '🏅 你拿下了黑客松一等奖，奖金 ¥15,000！'); } else log(s, '没拿奖，但认识了不少人。');
        } },
      { label: '不去，保命要紧', run: () => {} },
    ],
  },
  plan: {
    w: 2, cond: s => s.agents.length >= 2 && s.cash > 30000,
    init: s => ({ mid: s.agents[0].modelId }),
    text: (s, c) => `${getModel(s, c.mid).vendor} 推出年付套餐：预付 ¥15,000，${getModel(s, c.mid).name} 接下来 60 天 5 折。`,
    options: [
      { label: '买套餐', run: (s, c) => { s.cash -= 15000; getModel(s, c.mid).discountUntil = s.day + 60; } },
      { label: '按量付费就好', run: () => {} },
    ],
  },
  beta: {
    w: 3, cond: s => s.cash > 25000 && !!nextModel(s),
    init: s => ({ mid: nextModel(s).id }),
    text: (s, c) => { const m = D.models.find(m => m.id === c.mid); return `${m.vendor} 邀请你内测还没发布的 ${m.name}（产出 ${m.power}，质量 ${m.quality}），内测费 ¥10,000。`; },
    options: [
      { label: '抢先体验（-¥10,000，立即可用）', run: (s, c) => {
          s.cash -= 10000;
          s.models.push({ ...D.models.find(m => m.id === c.mid) });
        } },
      { label: '等正式版', run: () => {} },
    ],
  },
  acquire: {
    w: 1, cond: s => s.rep >= 60 && s.day >= 90,
    init: s => ({ price: Math.round((s.cash + s.mrr * 24 + s.rep * 3000 + s.agents.length * 20000) / 1000) * 1000 }),
    text: (s, c) => `一家大厂想收购你的一人公司，开价 ${yuan(c.price)}。接受就意味着游戏结束（收购结局）。`,
    options: [
      { label: '婉拒，我要自己做大（声誉 +5）', run: s => { s.rep += 5; } },
      { label: '接受收购，财务自由！', run: (s, c) => { s.over = 'sold'; s.soldFor = c.price; } },
    ],
  },
};

function randomEvent(s, rand) {
  if (rand() < 0.5) {
    const pool = Object.entries(CHOICES).filter(([, e]) => e.cond(s));
    if (!pool.length) return;
    let r = rand() * pool.reduce((t, [, e]) => t + e.w, 0);
    const [id, e] = pool.find(([, e]) => (r -= e.w) < 0);
    s.pending = { id, ctx: e.init(s, rand) };
    return;
  }
  const g = boosts(s).guard;
  const pool = NEWS.filter(e => !g.includes(e.guard));
  let r = rand() * pool.reduce((t, e) => t + e.w, 0);
  const text = pool.find(e => (r -= e.w) < 0).run(s, rand);
  if (text) log(s, '📰 ' + text);
}

// 给 UI 用：当前待选事件的文字和选项
function pendingView(s) {
  if (!s.pending) return null;
  const e = CHOICES[s.pending.id];
  return { text: e.text(s, s.pending.ctx), options: e.options.map(o => o.label) };
}

function choose(s, i, rand = Math.random) {
  if (!s.pending) return false;
  const e = CHOICES[s.pending.id], o = e.options[i];
  if (!o) return false;
  const { ctx } = s.pending;
  log(s, `🗳️ ${e.text(s, ctx)} → ${o.label}`);
  s.pending = null;
  o.run(s, ctx, rand);
  s.rep = clamp(s.rep, 0, 100);
  if (s.over === 'sold') log(s, `🤝 你以 ${yuan(s.soldFor)} 卖掉了公司，第 ${s.day} 天退休。`, true);
  return true;
}

// ---- 自动化 ----

function setAuto(s, key, on) { if (key in s.auto) s.auto[key] = !!on; }

// 团队对某类项目的日产出估计（按当前模型/模式/升级/等级/职业匹配）
function teamRate(s, type) {
  const up = boosts(s), mode = MODES[s.mode];
  return s.agents.reduce((t, a) => t + getModel(s, a.modelId).power * mode.work * up.work *
    (1 + 0.15 * (a.level - 1)) * (D.roles[a.role].type === type ? 1.5 : 1), 0);
}
// 团队平均交付质量估计
function teamQuality(s) {
  if (!s.agents.length) return 0;
  const q = MODES[s.mode].q + boosts(s).q;
  return s.agents.reduce((t, a) => t + clamp(getModel(s, a.modelId).quality + q, 0, 1), 0) / s.agents.length;
}

// 只接「质量够得上、按现有排期做得完」的单，按单位报酬从高到低
function autoAccept(s) {
  const q = teamQuality(s);
  for (const o of [...s.offers].sort((a, b) => b.reward / b.work - a.reward / a.work)) {
    if (q < o.minQ) continue;
    const load = s.projects.reduce((t, p) => t + Math.max(0, p.work - p.done), 0) + o.work;
    if (load / teamRate(s, o.type) > o.days * 0.8) continue;
    accept(s, o.id);
    log(s, `📥 自动接单「${o.name}」${yuan(o.reward)}`);
  }
}

// 半自动推进：一直过天，直到有值得你看一眼的事（最多 max 天）
function runUntil(s, max = 30, rand = Math.random) {
  for (let d = 1; d <= max; d++) {
    const cash0 = s.cash, busy0 = new Set(s.agents.filter(a => a.busy).map(a => a.id));
    if (!tick(s, rand)) return { days: d - 1, reason: s.pending ? '有事件需要你决定' : '游戏已结束' };
    const hit = s.report.lines.find(t => /^(✅|❌|📰)/.test(t));
    const why = s.over ? '游戏结束'
      : s.pending ? '有事件需要你决定'
      : s.popups.length ? '行业快讯'
      : hit ? hit
      : !s.auto.accept && s.offers.length && s.agents.some(a => busy0.has(a.id) && !a.busy) ? '有 agent 闲下来了，订单板上有单'
      : s.cash < 10000 && cash0 >= 10000 ? '现金跌破 ¥10,000'
      : null;
    if (why) return { days: d, reason: why };
  }
  return { days: max, reason: `已连续推进 ${max} 天` };
}

// ---- 每天推进一次 ----

function tick(s, rand = Math.random) {
  if (s.over || s.pending) return false;
  s.day++;
  s.report = { day: s.day, lines: [], work: [], income: 0, token: 0 };
  const up = boosts(s);

  // CEO 今日行动（精力不够就自动退回日常管理）
  let act = D.actions[s.action];
  if (s.auto.rest && s.energy < 30) act = D.actions.rest; // 只替换今天，不改玩家选的行动
  if (s.energy + act.energy < 0) act = D.actions.manage;
  s.energy = clamp(s.energy + act.energy, 0, 100);
  if (act === D.actions.sales) { s.offers.push(makeOffer(s, rand, 1.1)); log(s, '🤝 你跑了一天客户，带回一个新订单'); }
  if (act === D.actions.tweet) s.rep += 2;
  if (act === D.actions.tune) s.agents.forEach(a => gainXp(s, a, 4));
  const qBonus = up.q + (act === D.actions.review ? 0.1 : 0) - (s.energy < TIRED ? 0.05 : 0);
  s.report.work.push(`👤 你：${act.name}（精力 ${s.energy}）${s.energy < TIRED ? ' — 太累了，全员质量 -5%' : ''}`);

  // 模型发布 / 下线
  for (const m of D.models) {
    if (m.release === s.day) {
      if (!getModel(s, m.id)) s.models.push({ ...m }); // 内测过的已经在列表里
      log(s, `🚀 ${m.vendor} 发布了 ${m.name}！价格 ¥${m.price}/M，产出 ${m.power}，质量 ${m.quality}`, true);
      if (m.priceWar) {
        s.models.forEach(x => { if (x.id !== m.id) x.price = Math.round(x.price * 0.75 * 10) / 10; });
        log(s, '💥 新模型引发全行业价格战，其他模型全部降价 25%！', true);
      }
    }
    if (m.retire === s.day && getModel(s, m.id)) {
      s.models = s.models.filter(x => x.id !== m.id);
      const fallback = s.models.reduce((a, b) => (Math.abs(b.price - m.price) < Math.abs(a.price - m.price) ? b : a)); // 迁到价格最接近的，避免成本暴涨
      const moved = s.agents.filter(a => a.modelId === m.id);
      moved.forEach(a => (a.modelId = fallback.id));
      log(s, `⚰️ ${m.name} 正式下线` + (moved.length ? `，${moved.length} 个 agent 被强制迁移到 ${fallback.name}` : ''), true);
    }
  }

  // 订单板：过期 + 新单（声誉越高、有官网，来单越快）
  s.offers = s.offers.filter(o => o.expires > s.day);
  if (s.offers.length < 5 && rand() < (0.15 + s.rep / 400) * up.lead * (D.directions.find(d => d.id === s.dir).lead || 1)) s.offers.push(makeOffer(s, rand));
  if (s.auto.accept) autoAccept(s);

  // agent 干活、烧 token：手动指派优先，否则同类型里最早截止的
  const mode = MODES[s.mode];
  for (const a of s.agents) {
    let p = s.projects.find(p => p.id === a.target);
    if (!p) {
      a.target = null;
      const mine = s.projects.filter(p => p.type === D.roles[a.role].type);
      p = (mine.length ? mine : s.projects).reduce((x, y) => (!x || y.deadline < x.deadline ? y : x), null);
    }
    a.busy = p ? p.id : null;
    if (!p) { s.report.work.push(`💤 ${a.name} 空闲`); continue; }
    const m = getModel(s, a.modelId);
    const cost = dailyCost(s, a);
    s.cash -= cost;
    s.month.token += cost;
    s.total.token += cost;
    const w = m.power * mode.work * up.work * (1 + 0.15 * (a.level - 1)) * (D.roles[a.role].type === p.type ? 1.5 : 1) * (s.throttle > 0 ? 0.5 : 1);
    p.done += w;
    p.qsum += w * clamp(m.quality + mode.q + qBonus, 0, 1);
    s.report.token += cost;
    s.report.work.push(`🤖 ${a.name} → ${p.name}：产出 ${w.toFixed(1)}，烧 ${yuan(cost)}`);
    if (!p.crew.includes(a.id)) p.crew.push(a.id);
    gainXp(s, a, 1);
  }
  if (s.throttle > 0) s.throttle--;

  // 交付 / 逾期
  for (const p of [...s.projects]) {
    if (p.done >= p.work) {
      const q = p.qsum / p.done;
      // 超出要求最多 +15%；不达标按差距平方扣钱
      const pay = Math.round(p.reward * (q >= p.minQ ? Math.min(1.15, q / p.minQ) : (q / p.minQ) ** 2));
      s.cash += pay;
      s.month.income += pay;
      s.total.income += pay;
      s.report.income += pay;
      s.rep = clamp(s.rep + (q >= p.minQ ? 2 : -4), 0, 100);
      if (p.type === 'service') s.mrr += Math.round(p.reward * 0.04);
      log(s, `✅ 交付「${p.name}」质量 ${Math.round(q * 100)}%（要求 ${Math.round(p.minQ * 100)}%），收入 ${yuan(pay)}`);
      s.projects.splice(s.projects.indexOf(p), 1);
    } else if (s.day > p.deadline) {
      s.rep = clamp(s.rep - 8, 0, 100);
      log(s, `❌「${p.name}」逾期，客户取消合同，声誉 -8`);
      s.projects.splice(s.projects.indexOf(p), 1);
    }
  }

  if (s.day > 3 && rand() < 0.18) randomEvent(s, rand);
  s.rep = clamp(s.rep, 0, 100);

  // 月结
  if (s.day % 30 === 0) {
    const fixed = RENT + UPKEEP * s.agents.length + s.extraFixed;
    s.total.fixed += fixed;
    s.cash += s.mrr - fixed;
    log(s, `📅 第 ${s.day / 30} 月结算：项目收入 ${yuan(s.month.income)}，订阅 ${yuan(s.mrr)}，` +
      `token ${yuan(s.month.token)}，固定开销 ${yuan(fixed)}`);
    s.month = { income: 0, token: 0 };
  }

  s.hist.push(s.cash);
  if (s.hist.length > 90) s.hist.shift();

  if (s.cash < 0) {
    const i = Math.round(-s.cash * INTEREST);
    s.cash -= i;
    log(s, `⚠️ 透支中（额度 ${yuan(CREDIT)}），今日利息 ${yuan(i)}`);
  }
  if (s.cash < -CREDIT) { s.over = 'lose'; s.pending = null; log(s, `💸 透支超过额度，公司在第 ${s.day} 天破产了。`, true); }
  else if (s.cash >= GOAL) { s.over = 'win'; s.pending = null; log(s, `🏆 第 ${s.day} 天现金突破 ${yuan(GOAL)}，一人公司成功了！`, true); }
  return true;
}

const SIM = {
  D, MODES, TOKENS_PER_DAY, SWITCH_FEE, GOAL, MAX_AGENTS, TIRED, CREDIT, SAVE_V, CHOICES,
  newGame, tick, runUntil, setAuto, autoAccept, teamQuality, accept, hire, fire, setModel, setTarget, setMode, setAction, buy, choose, pendingView,
  hireCost, getModel, priceOf, dailyCost,
};
if (typeof module !== 'undefined') module.exports = SIM;
