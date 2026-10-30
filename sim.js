// 纯逻辑层：无 DOM。浏览器里作为普通 <script> 加载，bun test 里 require。
const D = typeof module !== 'undefined' ? require('./data.js') : DATA;

const TOKENS_PER_DAY = 6;        // 每个工作中的 agent 每天消耗的百万 token（标准模式）
const RENT = 3000;               // 月租 + 订阅
const UPKEEP = 800;              // 每个 agent 每月的部署/运维费
const SWITCH_FEE = 500;          // 换模型的迁移费（提示词重调）
const GOAL = 1000000;            // 现金达到即胜利
const MAX_AGENTS = 8;            // 办公室工位数
const MODES = {
  eco: { name: '省钱', tok: 0.5, work: 0.65, q: -0.05 },
  normal: { name: '标准', tok: 1, work: 1, q: 0 },
  turbo: { name: '深度思考', tok: 2, work: 1.4, q: 0.05 },
};

const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const getModel = (s, id) => s.models.find(m => m.id === id);
const hireCost = s => 5000 + 3000 * s.agents.length;

function log(s, text, popup = false) {
  s.log.unshift({ day: s.day, text });
  s.log.length = Math.min(s.log.length, 60);
  if (s.report) s.report.lines.push(text);
  if (popup) s.popups.push(text);
}

function newGame(dirId, rand = Math.random) {
  const dir = D.directions.find(d => d.id === dirId);
  const s = {
    day: 0, dir: dir.id, cash: dir.cash, rep: 10, mrr: 0, mode: 'normal', throttle: 0,
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
  const a = { id: s.nextId++, name, role, modelId, level: 1, busy: null };
  s.agents.push(a);
  return a;
}

function makeOffer(s, rand, bonus = 1) {
  const mix = D.directions.find(d => d.id === s.dir).mix;
  let r = rand(), type = 'code';
  for (const [t, w] of Object.entries(mix)) { if ((r -= w) < 0) { type = t; break; } }
  const T = D.types[type];
  const work = Math.round(T.min + rand() * (T.max - T.min));
  return {
    id: s.nextId++, type, name: pick(T.names, rand), work,
    reward: Math.round(work * 120 * (1 + s.rep / 200) * (0.8 + rand() * 0.4) * bonus / 100) * 100,
    minQ: Math.round((0.5 + rand() * 0.35 + work / 1000) * 100) / 100,
    days: Math.ceil(work / 2.5) + 10,
    expires: s.day + 20,
  };
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
  if (s.cash < cost) return log(s, `招募需要 ¥${cost.toLocaleString()}，现金不足。`), false;
  s.cash -= cost;
  const a = makeAgent(s, role, (s.agents[0] || {}).modelId || s.models[0].id, rand);
  log(s, `新 agent「${a.name}」(${D.roles[role].name}) 上岗，花费 ¥${cost.toLocaleString()}。`);
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
  log(s, `「${a.name}」切换到 ${getModel(s, modelId).name}（迁移费 ¥${SWITCH_FEE}）。`);
  return true;
}

function setMode(s, mode) { if (MODES[mode]) s.mode = mode; }

// ---- 随机事件：每天约 7% 概率触发一个 ----

const EVENTS = [
  { w: 3, run: s => { s.rep += 5; return '你的一条「一人公司日赚过万」推文爆了，声誉 +5'; } },
  { w: 3, run: s => { s.cash -= 2000; return '云服务器宕机，紧急修复花费 ¥2,000'; } },
  { w: 3, run: s => {
      const p = s.projects[0]; if (!p) return null;
      p.done *= 0.8; s.rep -= 3;
      return `Agent 幻觉事故！「${p.name}」里编造了不存在的 API，进度 -20%，声誉 -3`;
    } },
  { w: 1, run: s => {
      if (s.rep < 30) return null;
      s.cash += 30000; return '天使投资人看中了你的一人公司，注资 ¥30,000！';
    } },
  { w: 2, run: s => { s.cash -= 3000; return '遭遇提示词注入攻击，API 账单被刷了 ¥3,000'; } },
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
  { w: 3, run: (s, rand) => { s.offers.push(makeOffer(s, rand, 1.6)); return '老客户介绍了一个高价单子，快去看看！'; } },
  { w: 2, run: s => {
      if (!s.agents.length) return null;
      const x = 500 * s.agents.length; s.cash -= x;
      return `某个 agent 陷入死循环，一夜烧掉 ¥${x.toLocaleString()} 的 token`;
    } },
  { w: 1, run: s => { s.agents.forEach(a => a.level = Math.min(5, a.level + 1)); return '你通宵打磨了 system prompt，所有 agent 等级 +1'; } },
  { w: 1, run: s => { s.cash -= 5000; return '监管新规：AI 生成内容必须标注，合规整改花费 ¥5,000'; } },
  { w: 2, run: s => { s.rep += 6; return '受邀在 AI 峰会分享「一个人 + 一群 agent」，声誉 +6'; } },
];

function randomEvent(s, rand) {
  let r = rand() * EVENTS.reduce((t, e) => t + e.w, 0);
  const e = EVENTS.find(e => (r -= e.w) < 0);
  const text = e.run(s, rand);
  if (text) log(s, '📰 ' + text);
}

// ---- 每天推进一次 ----

function tick(s, rand = Math.random) {
  if (s.over) return;
  s.day++;
  s.report = { day: s.day, lines: [], work: [], income: 0, token: 0 };

  // 模型发布 / 下线
  for (const m of D.models) {
    if (m.release === s.day) {
      s.models.push({ ...m });
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

  // 订单板：过期 + 新单（声誉越高来单越快）
  s.offers = s.offers.filter(o => o.expires > s.day);
  if (s.offers.length < 5 && rand() < 0.15 + s.rep / 400) s.offers.push(makeOffer(s, rand));

  // agent 干活、烧 token
  const mode = MODES[s.mode];
  for (const a of s.agents) {
    const mine = s.projects.filter(p => p.type === D.roles[a.role].type);
    const p = (mine.length ? mine : s.projects).reduce((x, y) => (!x || y.deadline < x.deadline ? y : x), null);
    a.busy = p ? p.id : null;
    if (!p) { s.report.work.push(`💤 ${a.name} 空闲`); continue; }
    const m = getModel(s, a.modelId);
    const cost = TOKENS_PER_DAY * mode.tok * m.price;
    s.cash -= cost;
    s.month.token += cost;
    const w = m.power * mode.work * (1 + 0.15 * (a.level - 1)) * (D.roles[a.role].type === p.type ? 1.5 : 1) * (s.throttle > 0 ? 0.5 : 1);
    p.done += w;
    s.report.token += cost;
    s.report.work.push(`🤖 ${a.name} → ${p.name}：产出 ${w.toFixed(1)}，烧 ¥${Math.round(cost)}`);
    p.qsum += w * clamp(m.quality + mode.q, 0, 1);
    if (!p.crew.includes(a.id)) p.crew.push(a.id);
  }
  if (s.throttle > 0) s.throttle--;

  // 交付 / 逾期
  for (const p of [...s.projects]) {
    if (p.done >= p.work) {
      const q = p.qsum / p.done;
      const pay = Math.round(p.reward * clamp(q / p.minQ, 0.5, 1.3));
      s.cash += pay;
      s.month.income += pay;
      s.report.income += pay;
      s.rep = clamp(s.rep + (q >= p.minQ ? 2 : -4), 0, 100);
      if (p.type === 'service') s.mrr += Math.round(p.reward * 0.04);
      s.agents.filter(a => p.crew.includes(a.id) && a.level < 5 && rand() < 0.25).forEach(a => a.level++);
      log(s, `✅ 交付「${p.name}」质量 ${Math.round(q * 100)}%（要求 ${Math.round(p.minQ * 100)}%），收入 ¥${pay.toLocaleString()}`);
      s.projects.splice(s.projects.indexOf(p), 1);
    } else if (s.day > p.deadline) {
      s.rep = clamp(s.rep - 8, 0, 100);
      log(s, `❌「${p.name}」逾期，客户取消合同，声誉 -8`);
      s.projects.splice(s.projects.indexOf(p), 1);
    }
  }

  if (s.day > 5 && rand() < 0.07) randomEvent(s, rand);
  s.rep = clamp(s.rep, 0, 100);

  // 月结
  if (s.day % 30 === 0) {
    const fixed = RENT + UPKEEP * s.agents.length;
    s.cash += s.mrr - fixed;
    log(s, `📅 第 ${s.day / 30} 月结算：项目收入 ¥${Math.round(s.month.income).toLocaleString()}，订阅 ¥${s.mrr.toLocaleString()}，` +
      `token ¥${Math.round(s.month.token).toLocaleString()}，固定开销 ¥${fixed.toLocaleString()}`);
    s.month = { income: 0, token: 0 };
  }

  s.hist.push(s.cash);
  if (s.hist.length > 90) s.hist.shift();

  if (s.cash < 0) { s.over = 'lose'; log(s, `💸 现金耗尽，公司在第 ${s.day} 天破产了。`, true); }
  else if (s.cash >= GOAL) { s.over = 'win'; log(s, `🏆 第 ${s.day} 天现金突破 ¥100 万，一人公司成功了！`, true); }
}

const SIM = { D, MODES, TOKENS_PER_DAY, SWITCH_FEE, GOAL, MAX_AGENTS, newGame, tick, accept, hire, fire, setModel, setMode, hireCost, getModel };
if (typeof module !== 'undefined') module.exports = SIM;
