import { test, expect } from 'bun:test';
const S = require('./sim.js');

// 可复现的随机数
const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// 简单自动玩家：有空就接单、钱多就招人
function autoplay(s, rand, days) {
  for (let i = 0; i < days && !s.over; i++) {
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

test('现金为负即破产', () => {
  const s = S.newGame('code');
  s.cash = -1;
  S.tick(s, () => 0.99);
  expect(s.over).toBe('lose');
});

test('新模型发布后可切换，且下一天成本随之变化', () => {
  const s = S.newGame('code');
  s.offers = [];
  s.projects.push({ id: 99, type: 'code', name: 't', work: 1e9, reward: 0, minQ: 0, deadline: 1e9, done: 0, qsum: 0, crew: [] });
  while (s.day < 40) S.tick(s, () => 0.99);
  expect(S.getModel(s, 'qw3')).toBeTruthy();
  s.cash = 1e5;
  expect(S.setModel(s, s.agents[0].id, 'qw3')).toBe(true);
  const before = s.cash;
  S.tick(s, () => 0.99);
  expect(before - s.cash).toBeCloseTo(S.TOKENS_PER_DAY * 6);
});

test('模型下线时 agent 被强制迁移', () => {
  const s = S.newGame('code');
  while (s.day < 210) { s.cash = 1e5; S.tick(s, () => 0.99); }
  expect(S.getModel(s, 'cs35')).toBeUndefined();
  expect(S.getModel(s, s.agents[0].modelId)).toBeTruthy();
});

test('平衡性：自动玩家开局不秒破产，也不会无限暴富', () => {
  for (const dir of ['code', 'content', 'service']) {
    const results = [1, 2, 3, 4, 5].map(seed => autoplay(S.newGame(dir, seeded(seed)), seeded(seed * 7), 720));
    const summary = results.map(s => `${s.over || '-'}@${s.day} ¥${Math.round(s.cash)} rep${s.rep} n${s.agents.length}`);
    console.log(dir, summary.join(' | '));
    for (const s of results) expect(s.over === 'lose' && s.day < 90).toBe(false);
    expect(results.some(s => s.over === 'win' && s.day < 300)).toBe(false);
  }
});
