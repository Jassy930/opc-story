// 数值平衡分析：bun balance.js [局数]
// 用几种固定策略跑完整对局，看通关天数/破产率/成本结构，判断数值方向是否合理。
const S = require('./sim.js');
const N = +process.argv[2] || 20;
const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const costPerWork = m => m.price / m.power;
const median = a => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : NaN);

// 模型策略：给某个 agent 挑模型
const MODEL = {
  keep: () => null,
  cheap: s => s.models.reduce((a, b) => (costPerWork(b) < costPerWork(a) ? b : a)),
  best: s => s.models.reduce((a, b) => (b.quality > a.quality ? b : a)),
  // 满足手上项目质量要求的最便宜模型
  smart: (s, a) => {
    const type = S.D.roles[a.role].type;
    const ps = s.projects.filter(p => p.type === type);
    const need = Math.max(0.8, ...(ps.length ? ps : s.projects).map(p => p.minQ)) - S.MODES[s.mode].q;
    const ok = s.models.filter(m => m.quality >= need);
    return ok.length ? ok.reduce((x, y) => (costPerWork(y) < costPerWork(x) ? y : x)) : MODEL.best(s);
  },
  // 满足要求的模型里，日利润（产出 × 单位报酬 − token 费）最高的
  margin: (s, a) => {
    const type = S.D.roles[a.role].type;
    const ps = s.projects.filter(p => p.type === type).length ? s.projects.filter(p => p.type === type) : s.projects;
    if (!ps.length) return null;
    const need = Math.max(...ps.map(p => p.minQ)) - S.MODES[s.mode].q;
    const perWork = ps.reduce((t, p) => t + p.reward, 0) / ps.reduce((t, p) => t + p.work, 0);
    const mode = S.MODES[s.mode];
    const k = mode.work * (1 + 0.15 * (a.level - 1)) * 1.5 * S.D.upgrades.reduce((t, u) => t * (s.upgrades.includes(u.id) && u.work || 1), 1); // 职业匹配/等级/升级
    const profit = m => m.power * k * perWork * Math.min(1.15, (m.quality + mode.q) / need) - S.TOKENS_PER_DAY * mode.tok * S.priceOf(s, m);
    const ok = s.models.filter(m => m.quality + mode.q >= need);
    return ok.length ? ok.reduce((x, y) => (profit(y) > profit(x) ? y : x)) : MODEL.best(s);
  },
};

function play(dir, seed, name) {
  const [strat, mode = 'normal'] = name.split(':');
  const rand = seeded(seed * 7), s = S.newGame(dir, seeded(seed));
  const role = S.D.directions.find(d => d.id === dir).role;
  let cash180 = null, busy = 0, agentDays = 0;
  if (strat !== 'naive') { s.auto.accept = true; s.auto.rest = true; }
  S.setMode(s, mode);
  while (!s.over && s.day < 900) {
    if (s.pending) S.choose(s, ['acquire', 'headhunt'].includes(s.pending.id) ? 0 : Math.floor(rand() * S.pendingView(s).options.length), rand);
    if (strat === 'naive') {
      while (s.offers.length && s.projects.length <= s.agents.length) S.accept(s, s.offers[0].id);
      if (s.cash > S.hireCost(s) * 3) S.hire(s, s.agents.length % 2 ? 'writer' : role, rand);
    } else {
      if (s.cash > S.hireCost(s) * 2.5) S.hire(s, role, rand);
      for (const u of S.D.upgrades) if (!s.upgrades.includes(u.id) && s.cash > u.cost * 2) S.buy(s, u.id);
      S.setAction(s, s.offers.length < 2 ? 'sales' : s.energy > 60 ? 'review' : 'manage');
      if (s.day % 5 === 0) for (const a of s.agents) {
        const m = MODEL[strat](s, a);
        if (m && m.id !== a.modelId) S.setModel(s, a.id, m.id);
      }
    }
    S.tick(s, rand);
    busy += s.agents.filter(a => a.busy).length; agentDays += s.agents.length;
    if (s.day === 180) cash180 = s.cash;
  }
  return { ...s, cash180, util: busy / agentDays };
}

console.log(`每格 ${N} 局。通关=现金到 ¥100 万；token占支出 = token /（token + 固定开销）；利用率 = 干活的 agent·天 / 全部 agent·天\n`);
console.log('方向      策略         通关  中位天数  破产  D180现金中位   token占支出  token占收入  agent利用率');
for (const dir of ['code', 'content', 'service']) {
  for (const strat of (process.argv[3] || 'naive,keep,cheap,best,smart,margin,margin:eco,margin:turbo').split(',')) {
    const rs = Array.from({ length: N }, (_, i) => play(dir, i + 1, strat));
    const wins = rs.filter(r => r.over === 'win');
    const tok = rs.reduce((t, r) => t + r.total.token, 0), fix = rs.reduce((t, r) => t + r.total.fixed, 0);
    console.log(dir.padEnd(9), strat.padEnd(12), String(wins.length).padStart(4), String(median(wins.map(r => r.day))).padStart(9),
      String(rs.filter(r => r.over === 'lose').length).padStart(5), ('¥' + Math.round(median(rs.map(r => r.cash180 ?? r.cash))).toLocaleString()).padStart(14),
      (Math.round(tok / (tok + fix) * 100) + '%').padStart(10),
      (Math.round(tok / rs.reduce((t, r) => t + r.total.income, 0) * 100) + '%').padStart(11),
      (Math.round(median(rs.map(r => r.util)) * 100) + '%').padStart(11));
  }
}
