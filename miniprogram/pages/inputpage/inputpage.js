const auth = require('../../services/auth')

const DEFAULT_SUBJECTS = [
  { key: 'physics', name: '物理', selected: true },
  { key: 'chemistry', name: '化学', selected: true },
  { key: 'biology', name: '生物', selected: false },
  { key: 'politics', name: '政治', selected: false },
  { key: 'history', name: '历史', selected: true },
  { key: 'geography', name: '地理', selected: false },
  { key: 'technology', name: '技术', selected: false }
]

Page({
  data: {
    province: '',
    totalScore: '',
    rank: '',
    scoreLevels: ['985/211附近', '重点线附近', '本科线附近', '专科层次', '不确定'],
    scoreLevel: '',
    scoreLevelIndex: -1,
    subjects: DEFAULT_SUBJECTS,
    selectedSubjectText: DEFAULT_SUBJECTS.filter(item => item.selected).map(item => item.name).join(' + '),
    mbti: '',
    interest: '',
    careerPlans: [
      {
        value: '本科就业',
        label: '本科就业',
        desc: '希望大学阶段尽早积累实习和作品，毕业后直接工作'
      },
      {
        value: '考研深造',
        label: '考研深造',
        desc: '接受长期学习投入，希望通过研究生阶段提升学校或专业层次'
      },
      {
        value: '考公考编',
        label: '考公考编',
        desc: '更重视稳定性，专业选择需兼顾岗位限制和竞争强度'
      },
      {
        value: '出国留学',
        label: '出国留学',
        desc: '考虑海外升学或就业，需关注专业国际认可度与成本'
      }
    ],
    careerPlan: '本科就业',
    personalInfo: ''
  },

  onShow() {
    const mbtiResult = wx.getStorageSync('mbtiResult')
    if (mbtiResult && mbtiResult.type) {
      this.setData({ mbti: mbtiResult.type })
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({
      [field]: e.detail.value
    })
  },

  onScoreLevelChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      scoreLevelIndex: index,
      scoreLevel: this.data.scoreLevels[index]
    })
  },

  toggleSubject(e) {
    const key = e.currentTarget.dataset.key
    const selectedCount = this.data.subjects.filter(item => item.selected).length
    const subjects = this.data.subjects.map(item => {
      if (item.key !== key) return item
      if (!item.selected && selectedCount >= 3) {
        wx.showToast({ title: '最多选择3门选考科目', icon: 'none' })
        return item
      }
      return { ...item, selected: !item.selected }
    })
    this.setData({
      subjects,
      selectedSubjectText: subjects.filter(item => item.selected).map(item => item.name).join(' + ') || '未选择'
    })
  },

  selectCareerPlan(e) {
    this.setData({
      careerPlan: e.currentTarget.dataset.value
    })
  },

  goToMbtiTest() {
    wx.navigateTo({
      url: '/pages/mbti-test/index',
      fail: (err) => {
        console.error('MBTI navigate failed', err)
        wx.showToast({ title: '无法打开MBTI测试页', icon: 'none' })
      }
    })
  },

  async submitForm() {
    const {
      province,
      totalScore,
      rank,
      scoreLevel,
      subjects,
      mbti,
      interest,
      careerPlan,
      personalInfo
    } = this.data

    const selectedSubjects = subjects.filter(item => item.selected).map(item => item.name)

    if (!province || !totalScore || !rank || !scoreLevel) {
      wx.showToast({ title: '请完善高考基础信息', icon: 'none' })
      return
    }

    if (selectedSubjects.length !== 3) {
      wx.showToast({ title: '请选择3门选考科目', icon: 'none' })
      return
    }

    if (!mbti || !interest || !personalInfo) {
      wx.showToast({ title: '请完善性格兴趣和个人想法', icon: 'none' })
      return
    }

    try {
      await auth.ensureLogin()
      const payload = encodeURIComponent(JSON.stringify({
        targetCareer: '职业与志愿分析',
        province,
        totalScore,
        rank,
        scoreLevel,
        selectedSubjects,
        mbti: mbti.toUpperCase(),
        interest,
        careerPlan,
        personalInfo,
        scoreDetail: `省份:${province}, 总分:${totalScore}, 位次:${rank}, 层次:${scoreLevel}, 选科:${selectedSubjects.join('+')}, MBTI:${mbti.toUpperCase()}, 兴趣:${interest}, 路径:${careerPlan}`
      }))
      wx.navigateTo({ url: `/pages/result/result?payload=${payload}` })
    } catch (err) {
      console.error(err)
      wx.showModal({
        title: '提交失败',
        content: err.message || '请稍后重试',
        showCancel: false
      })
    }
  }
})
