const QUESTIONS = [
  { axis: 'EI', left: 'I', right: 'E', text: '面对一个陌生专业方向时，我更倾向于先和别人讨论，再形成自己的判断。' },
  { axis: 'SN', left: 'S', right: 'N', text: '了解专业时，我更关注未来可能性，而不是眼前课程细节。' },
  { axis: 'TF', left: 'T', right: 'F', text: '做选择时，我会优先考虑这个方向是否符合自己的价值感。' },
  { axis: 'JP', left: 'J', right: 'P', text: '面对志愿填报，我更喜欢保留多个可能性，而不是太早锁死方案。' },
  { axis: 'EI', left: 'I', right: 'E', text: '我从和同学、老师、家长的讨论中获得更多想法和动力。' },
  { axis: 'SN', left: 'S', right: 'N', text: '比起具体稳定的岗位，我更容易被跨界、新兴、有想象力的职业吸引。' },
  { axis: 'TF', left: 'T', right: 'F', text: '如果一个专业很热门但我不喜欢，我通常很难长期坚持。' },
  { axis: 'JP', left: 'J', right: 'P', text: '我能接受大学期间边尝试边调整方向。' },
  { axis: 'EI', left: 'E', right: 'I', text: '长时间独立研究比频繁沟通协作更让我舒服。' },
  { axis: 'SN', left: 'N', right: 'S', text: '我更相信清晰可见的课程内容和就业岗位，而不是抽象的发展空间。' },
  { axis: 'TF', left: 'F', right: 'T', text: '当兴趣和现实收益冲突时，我更愿意用数据和回报来判断。' },
  { axis: 'JP', left: 'P', right: 'J', text: '我希望志愿表有明确边界和执行计划，减少后续变动。' },
  { axis: 'EI', left: 'I', right: 'E', text: '如果未来工作需要大量沟通展示，我通常会觉得有活力。' },
  { axis: 'SN', left: 'S', right: 'N', text: '我喜欢从趋势、行业变化和长期机会中寻找专业方向。' },
  { axis: 'TF', left: 'T', right: 'F', text: '我希望未来职业能帮助别人或产生明确的社会价值。' },
  { axis: 'JP', left: 'J', right: 'P', text: '面对未知机会，我更愿意先体验，再决定是否深入。' }
]

const SCALE_OPTIONS = [
  { label: '很不同意', value: -2 },
  { label: '不同意', value: -1 },
  { label: '中立', value: 0 },
  { label: '同意', value: 1 },
  { label: '很同意', value: 2 }
]

const TYPE_INFO = {
  ENFP: {
    name: '创意表达型探索者',
    desc: '通常重视兴趣、意义感和成长空间，适合表达、连接、创新和跨领域理解的方向。',
    fit: '产品策划、用户研究、传播、教育科技、内容运营等跨学科路径。',
    risk: '如果选择高度重复、反馈周期很长的专业，可能动力不足。'
  },
  INTJ: {
    name: '系统规划型分析者',
    desc: '通常重视长期目标、独立判断和系统能力，适合技术、研究、战略和复杂问题解决。',
    fit: '计算机、数据分析、工程管理、科研和战略类路径。',
    risk: '需要主动补充沟通表达和团队协作场景。'
  },
  ISFJ: {
    name: '稳定服务型执行者',
    desc: '通常重视稳定、责任和实际帮助，适合有明确规则和服务对象的方向。',
    fit: '师范、医学护理、公共管理、人力资源和稳定型岗位路径。',
    risk: '不要只追热门方向，需关注压力承受和岗位稳定性。'
  },
  default: {
    name: '综合探索型学生',
    desc: '当前倾向较均衡，建议结合真实兴趣、成绩位次和职业路径进一步判断。',
    fit: '优先选择可转向空间大、课程结构清晰、实践机会较多的专业。',
    risk: '需要避免只凭单一测试结果做最终选择。'
  }
}

Page({
  data: {
    questions: QUESTIONS,
    scaleOptions: SCALE_OPTIONS,
    currentIndex: 0,
    currentQuestion: QUESTIONS[0],
    currentAnswer: null,
    answers: [],
    progressBars: [true, false, false, false],
    finished: false,
    resultType: '',
    resultName: '',
    resultDesc: '',
    fitText: '',
    riskText: '',
    dimensions: []
  },

  selectAnswer(e) {
    const value = Number(e.currentTarget.dataset.value)
    const answers = this.data.answers.slice()
    answers[this.data.currentIndex] = value
    this.setData({ answers, currentAnswer: value })
  },

  prevQuestion() {
    if (this.data.currentIndex <= 0) return
    this.setQuestion(this.data.currentIndex - 1)
  },

  nextQuestion() {
    if (typeof this.data.answers[this.data.currentIndex] !== 'number') {
      wx.showToast({ title: '请选择一个答案', icon: 'none' })
      return
    }
    if (this.data.currentIndex >= QUESTIONS.length - 1) {
      this.finishTest()
      return
    }
    this.setQuestion(this.data.currentIndex + 1)
  },

  setQuestion(index) {
    const progress = Math.ceil(((index + 1) / QUESTIONS.length) * 4)
    this.setData({
      currentIndex: index,
      currentQuestion: QUESTIONS[index],
      currentAnswer: this.data.answers[index],
      progressBars: [0, 1, 2, 3].map(i => i < progress)
    })
  },

  finishTest() {
    const scores = {
      E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0
    }

    QUESTIONS.forEach((question, index) => {
      const answer = this.data.answers[index] || 0
      if (answer >= 0) {
        scores[question.right] += answer
      } else {
        scores[question.left] += Math.abs(answer)
      }
    })

    const type = [
      scores.E >= scores.I ? 'E' : 'I',
      scores.N >= scores.S ? 'N' : 'S',
      scores.F >= scores.T ? 'F' : 'T',
      scores.P >= scores.J ? 'P' : 'J'
    ].join('')

    const info = TYPE_INFO[type] || TYPE_INFO.default
    const dimensions = [
      { label: `${type[0]} ${type[0] === 'E' ? '外向' : '内向'}`, score: this.calcScore(scores[type[0]], scores[type[0] === 'E' ? 'I' : 'E']) },
      { label: `${type[1]} ${type[1] === 'N' ? '直觉' : '实感'}`, score: this.calcScore(scores[type[1]], scores[type[1] === 'N' ? 'S' : 'N']) },
      { label: `${type[2]} ${type[2] === 'F' ? '情感' : '思考'}`, score: this.calcScore(scores[type[2]], scores[type[2] === 'F' ? 'T' : 'F']) },
      { label: `${type[3]} ${type[3] === 'P' ? '探索' : '计划'}`, score: this.calcScore(scores[type[3]], scores[type[3] === 'P' ? 'J' : 'P']) }
    ]

    this.setData({
      finished: true,
      resultType: type,
      resultName: info.name,
      resultDesc: info.desc,
      fitText: info.fit,
      riskText: info.risk,
      dimensions
    })
  },

  calcScore(main, other) {
    const total = Math.max(main + other, 1)
    return Math.max(52, Math.round((main / total) * 100))
  },

  useResult() {
    wx.setStorageSync('mbtiResult', {
      type: this.data.resultType,
      name: this.data.resultName,
      desc: this.data.resultDesc
    })
    wx.navigateBack()
  },

  restart() {
    this.setData({
      currentIndex: 0,
      currentQuestion: QUESTIONS[0],
      currentAnswer: null,
      answers: [],
      progressBars: [true, false, false, false],
      finished: false,
      resultType: '',
      resultName: '',
      resultDesc: '',
      fitText: '',
      riskText: '',
      dimensions: []
    })
  }
})
