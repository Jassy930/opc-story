// 游戏静态数据：公司方向、模型时间线、名字池。纯数据，改数值平衡只动这里。
const DATA = {
  directions: [
    { id: 'code', name: 'AI 编程外包', desc: '接企业外包需求，agent 写代码。单子大、报酬高、工期长。',
      cash: 30000, role: 'coder', mix: { code: 0.7, content: 0.15, service: 0.15 },
      intro: '你在大厂写了八年 CRUD，见过太多「这个需求很简单」。某天你发现，agent 写的代码已经比你一半的同事好了。你交了辞职信。' },
    { id: 'content', name: 'AI 内容工作室', desc: '文案、脚本、网文代写。单子小而多，周转快。',
      cash: 25000, role: 'writer', lead: 1.6, mix: { code: 0.15, content: 0.7, service: 0.15 },
      intro: '你做了五年新媒体编辑，一天写三篇十万加标题。后来老板说「以后 AI 写，你来审」，你想了想：那我为什么不自己干？' },
    { id: 'service', name: 'AI 客服 SaaS', desc: '给商家部署客服 agent。每单交付后带来持续月费 (MRR)。',
      cash: 28000, role: 'support', mix: { code: 0.15, content: 0.15, service: 0.7 },
      intro: '你在客服中心带过三十人的团队，最清楚凌晨三点的工单有多磨人。现在 agent 不睡觉、不委屈、不离职。你想让每家小店都用得起它。' },
  ],

  roles: {
    coder: { name: '程序员', type: 'code' },
    writer: { name: '写手', type: 'content' },
    support: { name: '客服', type: 'service' },
  },

  types: {
    code: { name: '编程', min: 30, max: 120,
      names: ['电商小程序', '企业官网重构', '数据看板', 'CRM 系统', '爬虫脚本', 'App 后端 API', '自动化测试', 'ERP 对接'] },
    content: { name: '内容', min: 10, max: 50, pay: 1.3, // 小单单价高
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

  // ---- 日常碎片：纯信息，不影响数值，只为了让你「经历」这段创业 ----
  // 占位符：{agent} {agent2} 随机 agent 名，{n} agent 数，{day} 天数，{newest} 最新模型
  flavor: [
    // 行业动态
    '🗞️ 某大厂宣布全员学 AI，不学的年终奖减半。',
    '🗞️ 即刻上又有人晒出「一人公司月入 10 万」，评论区一半在问怎么做，一半在说是假的。',
    '🗞️ {newest} 的评测榜单刷屏了，每家都说自己第一。',
    '🗞️ 有人统计：今年平均每天发布 1.3 个大模型。',
    '🗞️ 某 AI 硬件发布会演示翻车，主持人说「这是彩排时的录像」。',
    '🗞️ 《AI 会取代所有程序员吗？》第 1000 次出现在你的信息流里。',
    '🗞️ 某咨询公司报告：「一人公司将贡献 X% 的 GDP」。X 是多少，取决于你看哪一版。',
    '🗞️ 开源社区又吵起来了：只开放权重，到底算不算「开源」？',
    '🗞️ 某高校开设「Agent 工程」专业，招 30 人，报名 3000 人。',
    '🗞️ 某芯片公司 CEO 又穿着皮衣，在发布会上举起了一块新芯片。',
    '🗞️ Hacker News 首页今天有 7 条在讨论 agent。',
    '🗞️ 招聘网站数据：「提示词工程师」岗位在减少，「Agent 工程师」岗位翻倍。',
    '🗞️ AI 圈又出了个新词「Context Engineering」，你决定假装早就知道。',
    '🗞️ 创投报告说今年最热的赛道是「给 AI 用的工具」。你看了看自己，算是吗？',
    '🗞️ 有人在网上发起讨论：「一人公司」到底是自由，还是更卷的打工？帖子 2000 楼了。',
    // 生活与朋友圈
    '💬 妈妈打来电话：「你那个公司到底做什么的？」你解释了 20 分钟，她说：「哦，就是电脑帮你干活。」',
    '💬 前同事在群里问：「还招人吗？」你回：「不招人，只招 agent。」',
    '💬 大学同学婚宴上有人问你在哪高就，你说「自己开公司」，全桌安静了三秒。',
    '💬 楼下便利店老板问你每天在家敲什么，你说在管团队。他看了看你身后的空房间。',
    '💬 爸爸在家庭群转发了《警惕 AI 骗局》，并 @ 了你。',
    '💬 你的猫在键盘上走了一遍，{agent} 把它当成需求认真分析了半天。',
    '💬 相亲对象问你公司多少人，你说「1 个，加 {n} 个 agent」。对方说：「那就是 1 个。」',
    '💬 前老板给你的朋友圈点了个赞。你盯着那个赞看了很久。',
    '💬 凌晨三点你还在看日报，楼下的外卖小哥也还在跑单。某种意义上，你们都是一人公司。',
    '💬 老家亲戚问能不能用你的 AI 帮孩子写寒假作业。你委婉拒绝了。',
    '💬 咖啡馆隔壁桌在聊：「我们公司要上 AI 了，可能要裁员。」你默默把耳机音量调大了。',
    '💬 朋友问你后不后悔辞职。你想了想，说：「后悔的时间都拿去看账单了。」',
    // agent 小剧场
    '🤖 {agent} 在提交记录里写「这次真的修好了」。这是它第 7 次这么写。',
    '🤖 你只要一个函数，{agent} 交了一份 40 页的方案。',
    '🤖 {agent} 在日志里给自己留了一行注释：「// 老板应该不会看这里」。',
    '🤖 {agent} 花了 3 万 token 思考一个是非题，最后回答「这取决于具体情况」。',
    '🤖 {agent} 帮你回了一封客户邮件，语气比你本人礼貌十倍。',
    '🤖 {agent} 说任务完成了，附上了一个不存在的链接。',
    '🤖 你问 {agent}：「你觉得我们公司能成吗？」它说：「这是一个非常好的问题！」',
    '🤖 {agent} 和 {agent2} 在代码评审里互相夸了 200 轮，谁也没指出 bug。',
    '🤖 {agent} 凌晨四点提交了代码。它不需要睡觉，但你还是有点感动。',
    '🤖 「做个简单的登录页」被 {agent} 理解成了「设计一套企业级身份认证体系」。',
    '🤖 {agent} 又道歉了。它总是在道歉。你开始怀疑它在阴阳你。',
    '🤖 {agent} 在周报里写「本周完成了 120% 的工作量」。你没敢问分母是什么。',
    // 你的内心
    '💭 你算了一下，今天 token 花的钱，够你以前吃一周食堂。',
    '💭 第 {day} 天。你已经很久没开过超过 15 分钟的会了。真好。',
    '💭 你突然发现，已经不记得被 KPI 考核是什么感觉了。',
    '💭 深夜，你看着 agent 们安静地工作，有一种奇怪的宁静。',
    '💭 你开始用「我们」称呼公司，虽然「我们」里只有你一个人类。',
    '💭 你有时会想：如果哪天 agent 比你更懂怎么经营这家公司，会怎样？',
    '💭 今天没有 bug，没有客诉，也没有新模型发布。你有点不习惯。',
    '💭 你翻出创业第一天写的计划：一半已经过时，另一半还没开始。',
    '💭 你想起辞职那天，HR 问你「想清楚了吗」。现在你还是没想清楚，但已经在路上了。',
  ],

  // ---- 创业日记：一次性里程碑。popup: 是否弹窗；text 可以是函数 ----
  milestones: [
    { id: 'firstPay', title: '第一笔收入', popup: true, cond: s => s.delivered >= 1,
      text: '第一笔收入到账了。你盯着银行 App 的通知看了好一会儿，截图发给了妈妈。她回了一个大拇指，又补了一句：「是正经钱吧？」' },
    { id: 'firstFail', title: '第一次逾期', cond: s => s.failed >= 1,
      text: '第一次逾期。客户的消息很客气，但「合作取消」四个字很重。你在笔记里写：接单前，先把排期算清楚。' },
    { id: 'secondAgent', title: '第二个 agent', cond: s => s.agents.length >= 2,
      text: '第二个 agent 上岗了。给它写 system prompt 的时候，你有种当家长的感觉。' },
    { id: 'month1', title: '满月', cond: s => s.day >= 30,
      text: '满月了。一个月前，你还在纠结要不要辞职。' },
    { id: 'overdraft', title: '第一次透支', cond: s => s.cash < 0,
      text: '账户第一次变成负数。你关掉了所有社交软件，打开了 Excel。' },
    { id: 'firstUpgrade', title: '第一次买装备', cond: s => s.upgrades.length >= 1,
      text: '第一次给公司「买装备」。付钱的时候很心疼，但你告诉自己：这叫投资。' },
    { id: 'rep50', title: '被陌生人推荐', cond: s => s.rep >= 50,
      text: '有陌生人在网上推荐你：「找他们，靠谱。」这是你听过最好的评价。' },
    { id: 'cash100k', title: '账上 10 万', popup: true, cond: s => s.cash >= 100000,
      text: '账上第一次超过 10 万。你没有庆祝，而是先算了算：照现在的 token 消耗，这些钱能撑多久。' },
    { id: 'day100', title: '第 100 天', popup: true, cond: s => s.day >= 100,
      text: '第 100 天。你在即刻发了条「一人公司第 100 天，还活着」，收获 300 个赞，其中 3 个来自前同事。' },
    { id: 'lv5', title: '第一个 Lv5', cond: s => s.agents.some(a => a.level >= 5),
      text: s => `「${s.agents.find(a => a.level >= 5).name}」升到了 Lv5。它现在写的东西，比三年前的你好。你决定不去细想这件事。` },
    { id: 'mrr10k', title: '睡后收入破万', popup: true, cond: s => s.mrr >= 10000,
      text: '订阅收入超过了每月 1 万。就算明天什么都不做，公司也能活下去。原来这就是「睡后收入」。' },
    { id: 'cash300k', title: '30 万', cond: s => s.cash >= 300000,
      text: '30 万。你给自己换了把好椅子，这是创业以来唯一一笔「非必要开支」。' },
    { id: 'teamFull', title: '工位坐满', popup: true, cond: s => s.agents.length >= 8,
      text: '八个工位全坐满了。你曾以为「一人公司」意味着孤独，现在办公室很热闹——虽然只有你需要喝咖啡。' },
    { id: 'cash500k', title: '走到一半', popup: true, cond: s => s.cash >= 500000,
      text: '50 万，走到一半了。你想起最初的那个念头：证明一个人加一群 agent，也能做成一家真正的公司。好像……真的可以。' },
    { id: 'allUpgrades', title: '升级买齐', cond: s => s.upgrades.length >= 8,
      text: '所有升级都买齐了。公司现在是一台精密的机器，而你是唯一的操作员。' },
    { id: 'rep100', title: '声誉满了', popup: true, cond: s => s.rep >= 100,
      text: '声誉满了。行业群里开始有人叫你「老师」。你有点心虚，又有点开心。' },
    { id: 'cash800k', title: '看见终点', cond: s => s.cash >= 800000,
      text: '80 万。终点线已经能看见了。你把这段时间的日报从头翻了一遍。' },
    { id: 'year1', title: '一周年', popup: true, cond: s => s.day >= 365,
      text: '一周年。你在每个 agent 的 system prompt 里加了一句「谢谢你」。它们不会懂，但你想说。' },
  ],

  agentNames: ['小码', '阿文', 'Echo', 'Bolt', 'Nova', 'Pixel', 'Ada', 'Turing', 'Mochi', 'Kiwi', 'Zed', '豆包包', '小 K', 'Rex'],
};

if (typeof module !== 'undefined') module.exports = DATA;
