// 游戏静态数据：公司方向、模型时间线、名字池。纯数据，改数值平衡只动这里。
const DATA = {
  directions: [
    { id: 'code', name: 'AI 编程外包', desc: '接企业外包需求，agent 写代码。单子大、报酬高、工期长。',
      cash: 30000, role: 'coder', mix: { code: 0.7, content: 0.15, service: 0.15 } },
    { id: 'content', name: 'AI 内容工作室', desc: '文案、脚本、网文代写。单子小而多，周转快。',
      cash: 25000, role: 'writer', mix: { code: 0.15, content: 0.7, service: 0.15 } },
    { id: 'service', name: 'AI 客服 SaaS', desc: '给商家部署客服 agent。每单交付后带来持续月费 (MRR)。',
      cash: 28000, role: 'support', mix: { code: 0.15, content: 0.15, service: 0.7 } },
  ],

  roles: {
    coder: { name: '程序员', type: 'code' },
    writer: { name: '写手', type: 'content' },
    support: { name: '客服', type: 'service' },
  },

  types: {
    code: { name: '编程', min: 30, max: 120,
      names: ['电商小程序', '企业官网重构', '数据看板', 'CRM 系统', '爬虫脚本', 'App 后端 API', '自动化测试', 'ERP 对接'] },
    content: { name: '内容', min: 10, max: 50,
      names: ['品牌营销文案', '短视频脚本 x30', '网文代写', '公众号代运营', '说明书翻译', '播客文字稿', '游戏剧情'] },
    service: { name: '客服', min: 20, max: 80,
      names: ['奶茶店智能客服', '电商售后机器人', '医院导诊助手', '银行 FAQ 机器人', '酒店预订助手', '驾校咨询机器人'] },
  },

  // price: ¥ / 百万 token；power: 每天产出；quality: 交付质量 0~1
  // release / retire: 第几天发布 / 下线（0 = 开局就有）
  models: [
    { id: 'gpt4m', name: 'GePeTo-4o mini', vendor: 'OpenEye', color: '#7bd389', price: 4, power: 1.0, quality: 0.55, release: 0, retire: 75 },
    { id: 'ds2', name: 'DeepSink V2', vendor: '深渊求索', color: '#5b8def', price: 2, power: 0.9, quality: 0.5, release: 0, retire: 120 },
    { id: 'cs35', name: 'Claudia 3.5 Sonnet', vendor: 'Anthropick', color: '#e8945a', price: 30, power: 2.0, quality: 0.85, release: 0, retire: 105 },
    { id: 'qw3', name: 'Qwan 3', vendor: '阿里云朵', color: '#a07cf0', price: 6, power: 1.5, quality: 0.68, release: 20 },
    { id: 'gpt5', name: 'GePeTo-5', vendor: 'OpenEye', color: '#3fbf6f', price: 50, power: 2.8, quality: 0.92, release: 45 },
    { id: 'dsr1', name: 'DeepSink R1', vendor: '深渊求索', color: '#2f6fe0', price: 4, power: 2.0, quality: 0.78, release: 60, priceWar: true },
    { id: 'co4', name: 'Claudia 4 Opus', vendor: 'Anthropick', color: '#d9703a', price: 90, power: 3.2, quality: 0.97, release: 90 },
    { id: 'llb4', name: 'Llamb 4 (开源)', vendor: 'Meta-verse', color: '#4fc3c8', price: 1.5, power: 1.6, quality: 0.65, release: 120 },
    { id: 'jm3', name: 'Jiminy 3 Pro', vendor: 'Gugol', color: '#f2c94c', price: 20, power: 2.6, quality: 0.88, release: 150 },
    { id: 'kimo', name: 'Kimo K3', vendor: '月之亮面', color: '#e86fa8', price: 8, power: 2.4, quality: 0.82, release: 180 },
    { id: 'cs5', name: 'Claudia 5', vendor: 'Anthropick', color: '#ff7a3d', price: 60, power: 4.0, quality: 0.99, release: 225 },
  ],

  // CEO 每天可以做一件事。energy: 精力变化（负数为消耗）
  actions: {
    manage: { name: '日常管理', energy: 8, desc: '盯着就行，恢复少量精力' },
    rest: { name: '休息', energy: 30, desc: '好好睡一觉，大量恢复精力' },
    sales: { name: '跑客户', energy: -20, desc: '必定带回一个新订单' },
    review: { name: '亲自把关', energy: -20, desc: '今天所有产出质量 +10%' },
    tune: { name: '调提示词', energy: -15, desc: '全员经验 +4' },
    tweet: { name: '发推营销', energy: -10, desc: '声誉 +2' },
  },

  // 一次性购买的公司升级。work/tok 为乘数，q 为质量加成，lead 为来单速度乘数，guard 为免疫的事件标签
  upgrades: [
    { id: 'seo', name: '官网 + SEO', cost: 10000, desc: '来单速度 +50%', lead: 1.5 },
    { id: 'promptlib', name: 'Prompt 模板库', cost: 12000, desc: '全员产出 +10%', work: 1.1 },
    { id: 'monitor', name: '监控告警', cost: 15000, desc: '免疫「死循环烧钱」「提示词注入」', guard: 'ops' },
    { id: 'cache', name: 'Prompt Caching', cost: 18000, desc: 'token 消耗 -25%', tok: 0.75 },
    { id: 'rag', name: 'RAG 知识库', cost: 25000, desc: '交付质量 +5%', q: 0.05 },
    { id: 'evals', name: '自动化评测 Evals', cost: 30000, desc: '质量 +5%，免疫「幻觉事故」', q: 0.05, guard: 'hallu' },
    { id: 'router', name: '模型路由器', cost: 35000, desc: 'token 消耗再 -20%', tok: 0.8 },
    { id: 'orch', name: '多 Agent 编排框架', cost: 45000, desc: '全员产出 +15%', work: 1.15 },
  ],

  agentNames: ['小码', '阿文', 'Echo', 'Bolt', 'Nova', 'Pixel', 'Ada', 'Turing', 'Mochi', 'Kiwi', 'Zed', '豆包包', '小 K', 'Rex'],
};

if (typeof module !== 'undefined') module.exports = DATA;
