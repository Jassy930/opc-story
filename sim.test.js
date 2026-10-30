import { test, expect } from 'bun:test';
const S = require('./sim.js');

// 可复现的随机数
const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// 简单自动玩家：有空就接单、钱多就招人
function autoplay(s, rand, days) {
  for (let i = 0; i < days && !s.over; i++) {
    if (s.pending) S.choose(s, Math.floor(rand() * S.pendingView(s).options.length), rand);
    while (s.offers.length && s.projects.length <= s.agents.length) S.accept(s, s.offers[0].id);
    if (s.cash > S.hireCost(s) * 3) S.hire(s, s.agents.length % 2 ? 'writer' : S.D.directions.find(d => d.id === s.dir).role, rand);
    S.tick(s, rand);
  }
  return s;
}

test('干活会烧 token 扣钱，空闲不扣', () => {
  const s = S.newGame('code', seeded(1));
  s.offers = [];
  const before = s.cash;
  S.tick(s, () => 0.99); // 0.99 避开新单和随机事件
  expect(s.cash).toBe(before);
  s.projects.push({ id: 99, type: 'code', name: 't', work: 1e9, reward: 0, minQ: 0, deadline: 1e9, done: 0, qsum: 0, crew: [] });
  S.tick(s, () => 0.99);
  expect(s.cash).toBe(before - S.TOKENS_PER_DAY * S.getModel(s, 'cs35').price);
});

test('透支额度内不破产（付利息），超过额度破产', () => {
  const s = S.newGame('code');
  s.offers = [];
  s.cash = -10000;
  S.tick(s, () => 0.99);
  expect(s.over).toBe(null);
  expect(s.cash).toBe(-10050);
  s.cash = -S.CREDIT - 1;
  S.tick(s, () => 0.99);
  expect(s.over).toBe('lose');
});

test('新模型发布后可切换，且下一天成本随之变化', () => {
  const s = S.newGame('code');
  s.offers = [];
  s.projects.push({ id: 99, type: 'code', name: 't', work: 1e9, reward: 0, minQ: 0, deadline: 1e9, done: 0, qsum: 0, crew: [] });
  while (s.day < 20) S.tick(s, () => 0.99);
  expect(S.getModel(s, 'qw3')).toBeTruthy();
  s.cash = 1e5;
  expect(S.setModel(s, s.agents[0].id, 'qw3')).toBe(true);
  const before = s.cash;
  S.tick(s, () => 0.99);
  expect(before - s.cash).toBeCloseTo(S.TOKENS_PER_DAY * 6);
});

test('模型下线时 agent 被强制迁移', () => {
  const s = S.newGame('code');
  while (s.day < 105) { s.cash = 1e5; S.tick(s, () => 0.99); }
  expect(S.getModel(s, 'cs35')).toBeUndefined();
  expect(S.getModel(s, s.agents[0].modelId)).toBeTruthy();
});

test('平衡性：自动玩家开局不秒破产，也不会无限暴富', () => {
  for (const dir of ['code', 'content', 'service']) {
    const results = [1, 2, 3, 4, 5].map(seed => autoplay(S.newGame(dir, seeded(seed)), seeded(seed * 7), 720));
    const summary = results.map(s => `${s.over || '-'}@${s.day} ¥${Math.round(s.cash)} rep${s.rep} n${s.agents.length}`);
    console.log(dir, summary.join(' | '));
    expect(results.filter(s => s.over === 'lose' && s.day < 90).length).toBeLessThanOrEqual(1); // 随机抉择的玩家偶尔玩崩可以接受，系统性早破产不行
    expect(results.some(s => s.over === 'win' && s.day < 150)).toBe(false);
  }
});

test('存档安全：状态可 JSON 往返后继续推进', () => {
  const s = autoplay(S.newGame('content', seeded(3)), seeded(9), 60);
  expect(s.over).toBe(null);
  const t = JSON.parse(JSON.stringify(s));
  expect(t).toEqual(s);
  S.tick(t, seeded(1));
  expect(t.day).toBe(s.day + 1);
  expect(t.report.day).toBe(t.day);
});

const bigProject = id => ({ id, type: 'code', name: 'p' + id, work: 1e9, reward: 0, minQ: 0, deadline: 1e9, done: 0, qsum: 0, crew: [] });

test('抉择事件会阻塞推进，选择后才能继续', () => {
  const s = S.newGame('code');
  s.projects.push(bigProject(99));
  s.pending = { id: 'rush', ctx: { pid: 99 } };
  expect(S.tick(s)).toBe(false);
  expect(s.day).toBe(0);
  expect(S.pendingView(s).options.length).toBe(2);
  S.choose(s, 0);
  expect(s.pending).toBe(null);
  expect(s.projects[0].deadline).toBe(1e9 - 5);
  expect(S.tick(s, () => 0.99)).toBe(true);
});

test('手动指派生效；项目消失后回到自动分配', () => {
  const s = S.newGame('code');
  s.offers = [];
  s.projects.push(bigProject(1), { ...bigProject(2), deadline: 5e8 });
  S.setTarget(s, s.agents[0].id, 1);
  S.tick(s, () => 0.99);
  expect(s.agents[0].busy).toBe(1);
  s.projects.shift();
  S.tick(s, () => 0.99);
  expect(s.agents[0].busy).toBe(2);
  expect(s.agents[0].target).toBe(null);
});

test('升级 Prompt Caching 降低 token 成本', () => {
  const s = S.newGame('code');
  const before = S.dailyCost(s, s.agents[0]);
  s.cash = 1e5;
  expect(S.buy(s, 'cache')).toBe(true);
  expect(S.dailyCost(s, s.agents[0])).toBeCloseTo(before * 0.75);
  expect(S.buy(s, 'cache')).toBe(false);
});

test('自动接单：只接质量够得上、做得完的单', () => {
  const s = S.newGame('code');
  s.auto.accept = true;
  const base = { type: 'code', name: 'x', work: 20, reward: 5000, days: 30, expires: 99 };
  s.offers = [{ ...base, id: 901, minQ: 0.8 }, { ...base, id: 902, minQ: 0.95 }, { ...base, id: 903, minQ: 0.6, work: 500 }];
  S.tick(s, () => 0.99);
  expect(s.projects.map(p => p.id)).toEqual([901]); // 902 质量不够（cs35=0.85），903 工期内做不完
});

test('半自动推进：遇到抉择事件停下，且不超过上限', () => {
  const s = S.newGame('code');
  s.offers = [];
  let r = S.runUntil(s, 7, () => 0.99);
  expect(r.days).toBe(7);
  expect(s.day).toBe(7);
  s.projects.push(bigProject(99));
  s.pending = { id: 'rush', ctx: { pid: 99 } };
  r = S.runUntil(s, 7, () => 0.99);
  expect(r.days).toBe(0);
  expect(s.day).toBe(7);
});

test('低精力自动休息只替换当天，不改玩家选的行动', () => {
  const s = S.newGame('code');
  s.offers = [];
  s.auto.rest = true;
  s.energy = 25;
  S.setAction(s, 'sales');
  S.tick(s, () => 0.99);
  expect(s.energy).toBe(55);
  expect(s.action).toBe('sales');
});
