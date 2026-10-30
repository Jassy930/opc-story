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
    { id: 'gpt4m', name: 'GePeTo-4o mini', vendor: 'OpenEye', color: '#7bd389', price: 4, power: 1.0, quality: 0.55, release: 0, retire: 150 },
    { id: 'ds2', name: 'DeepSink V2', vendor: '深渊求索', color: '#5b8def', price: 2, power: 0.9, quality: 0.5, release: 0, retire: 240 },
    { id: 'cs35', name: 'Claudia 3.5 Sonnet', vendor: 'Anthropick', color: '#e8945a', price: 30, power: 2.0, quality: 0.85, release: 0, retire: 210 },
    { id: 'qw3', name: 'Qwan 3', vendor: '阿里云朵', color: '#a07cf0', price: 6, power: 1.5, quality: 0.68, release: 40 },
    { id: 'gpt5', name: 'GePeTo-5', vendor: 'OpenEye', color: '#3fbf6f', price: 50, power: 2.8, quality: 0.92, release: 90 },
    { id: 'dsr1', name: 'DeepSink R1', vendor: '深渊求索', color: '#2f6fe0', price: 4, power: 2.0, quality: 0.78, release: 120, priceWar: true },
    { id: 'co4', name: 'Claudia 4 Opus', vendor: 'Anthropick', color: '#d9703a', price: 90, power: 3.2, quality: 0.97, release: 180 },
    { id: 'llb4', name: 'Llamb 4 (开源)', vendor: 'Meta-verse', color: '#4fc3c8', price: 1.5, power: 1.6, quality: 0.65, release: 240 },
    { id: 'jm3', name: 'Jiminy 3 Pro', vendor: 'Gugol', color: '#f2c94c', price: 20, power: 2.6, quality: 0.88, release: 300 },
    { id: 'kimo', name: 'Kimo K3', vendor: '月之亮面', color: '#e86fa8', price: 8, power: 2.4, quality: 0.82, release: 360 },
    { id: 'cs5', name: 'Claudia 5', vendor: 'Anthropick', color: '#ff7a3d', price: 60, power: 4.0, quality: 0.99, release: 450 },
  ],

  agentNames: ['小码', '阿文', 'Echo', 'Bolt', 'Nova', 'Pixel', 'Ada', 'Turing', 'Mochi', 'Kiwi', 'Zed', '豆包包', '小 K', 'Rex'],
};

if (typeof module !== 'undefined') module.exports = DATA;
