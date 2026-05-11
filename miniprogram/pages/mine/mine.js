const PAYMENT_DISABLED_FOR_TEST = true
const DEFAULT_HISTORY_TITLE = '职业与志愿分析'
const GENERIC_HISTORY_TITLES = [DEFAULT_HISTORY_TITLE, '职业选择与志愿填报参考方案', 'AI完整报告', 'AI 完整报告']

function trimText(value, maxLength = 48) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function joinText(parts, separator = ' · ') {
  return parts.filter(Boolean).join(separator)
}

function cleanReportLine(value) {
  return String(value || '')
    .replace(/^#{1,6}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s*/g, '')
    .replace(/^核心结论[：:\s]*/g, '')
    .replace(/^推荐职业方向[：:\s]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function makeHistoryTitle(value) {
  const line = cleanReportLine(value)
  if (!line || GENERIC_HISTORY_TITLES.includes(line)) return ''

  const priorityMatch = line.match(/优先考虑(.+?)(?:\s*学生|[。；;]|$)/)
  if (priorityMatch && priorityMatch[1]) {
    return trimText(priorityMatch[1], 32)
  }

  const recommendMatch = line.match(/推荐(.+?)(?:\s*学生|[。；;]|$)/)
  if (recommendMatch && recommendMatch[1]) {
    return trimText(recommendMatch[1], 32)
  }

  return trimText(line, 32)
}

function extractHistoryTitleFromText(value) {
  const source = String(value || '')
    .replace(/\r/g, '')
    .replace(/(#{1,6}\s*)/g, '\n$1')
  if (!source.trim()) return ''

  const coreMatch = source.match(/(?:^|\n)\s*#{0,6}\s*核心结论\s*\n?([\s\S]*?)(?=\n\s*#{1,6}\s*|$)/)
  const coreLine = (coreMatch && coreMatch[1] ? coreMatch[1] : '').split('\n').find((line) => cleanReportLine(line))
  const coreTitle = makeHistoryTitle(coreLine)
  if (coreTitle) return coreTitle

  const careerMatch = source.match(/(?:^|\n)\s*#{0,6}\s*推荐职业方向\s*\n?([\s\S]*?)(?=\n\s*#{1,6}\s*|$)/)
  const careerLine = (careerMatch && careerMatch[1] ? careerMatch[1] : '').split('\n').find((line) => cleanReportLine(line))
  const careerTitle = makeHistoryTitle(careerLine)
  if (careerTitle) return careerTitle

  return makeHistoryTitle(source.split('\n').find((line) => {
    const clean = cleanReportLine(line)
    return clean && !GENERIC_HISTORY_TITLES.includes(clean)
  }))
}

function pickHistoryTitle(item) {
  const candidates = [
    item.primaryTitle,
    item.title,
    item.structuredReport && item.structuredReport.coreConclusion && item.structuredReport.coreConclusion.title,
    extractHistoryTitleFromText(item.summarySnippet),
    extractHistoryTitleFromText(item.summary),
    extractHistoryTitleFromText(item.fullContent),
    item.targetCareer,
    item.featureName
  ]

  for (const candidate of candidates) {
    const title = makeHistoryTitle(candidate)
    if (title) return title
  }
  return DEFAULT_HISTORY_TITLE
}

Page({
  data: {
    isLogged: false,
    historyRecords: [],
    historyPage: 1,
    historyPageSize: 10,
    historyHasMore: true,
    historyLoading: false,
    historyTotal: 0,
    historyHint: '可搜索',
    openid: '',
    userInfo: {
      avatarUrl: '',
      nickName: ''
    },
    needSave: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        value: 'pages/mine/mine'
      })
    }

    const openid = wx.getStorageSync('openid')
    if (openid) {
      this.setData({ isLogged: true })
      this.loginAndFetchUser()
    }
  },

  onReachBottom() {
    if (!this.data.isLogged) {
      return
    }
    this.loadHistoryRecords(false)
  },

  onPullDownRefresh() {
    if (!this.data.isLogged) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadHistoryRecords(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  async handleLogin() {
    wx.showLoading({ title: '登录中...' })
    await this.loginAndFetchUser()
    wx.hideLoading()
  },

  async loginAndFetchUser() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'user_manage',
        data: { type: 'login' }
      })

      if (res.result.success) {
        const user = res.result.userInfo
        wx.setStorageSync('openid', user._openid)

        this.setData({
          isLogged: true,
          openid: user._openid,
          userInfo: {
            avatarUrl: user.avatarUrl || '',
            nickName: user.nickName || ''
          }
        })

        await this.loadHistoryRecords(true)
      }
    } catch (err) {
      console.error('Login failed', err)
      wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    }
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('openid')
          this.setData({
            isLogged: false,
            historyRecords: [],
            historyPage: 1,
            historyHasMore: true,
            historyLoading: false,
            historyTotal: 0,
            historyHint: '可搜索',
            openid: '',
            userInfo: { avatarUrl: '', nickName: '' }
          })
        }
      }
    })
  },

  async loadHistoryRecords(reset = false) {
    if (!this.data.isLogged || this.data.historyLoading) {
      return
    }
    if (!reset && !this.data.historyHasMore) {
      return
    }

    const page = reset ? 1 : this.data.historyPage
    this.setData({ historyLoading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'get_user_records',
        data: {
          mode: 'history',
          page,
          pageSize: this.data.historyPageSize
        }
      })

      if (!res.result.success) {
        throw new Error(res.result.errMsg || '获取历史记录失败')
      }

      const list = (res.result.data || []).map((item) => this.normalizeHistoryItem(item))
      const merged = reset ? list : this.data.historyRecords.concat(list)

      this.setData({
        historyRecords: this.buildHistoryDisplayList(merged),
        historyPage: page + 1,
        historyHasMore: !!res.result.hasMore,
        historyTotal: res.result.total || 0,
        historyHint: res.result.total ? `共 ${res.result.total} 条` : '可搜索'
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '历史记录加载失败', icon: 'none' })
    } finally {
      this.setData({ historyLoading: false })
    }
  },

  loadMoreHistoryRecords() {
    this.loadHistoryRecords(false)
  },

  goToHistoryDetail(e) {
    const { recordType, sourceId } = e.currentTarget.dataset
    const resolvedType = recordType || 'career_plan'
    if (resolvedType === 'career_plan' && sourceId) {
      wx.navigateTo({
        url: `/pages/result/result?id=${sourceId}`
      })
      return
    }
    wx.showToast({ title: '该记录暂不支持查看详情', icon: 'none' })
  },

  normalizeHistoryItem(item) {
    const functionId = item.functionId || 'career_plan'
    const recordType = item.recordType || 'career_plan'
    const sourceId = item.sourceId || item._id || ''
    const resultId = item.resultId || item.recordId || ''
    const title = pickHistoryTitle(item)

    const time = item.time || item.createTime || item.unlockTime
    const isPaid = PAYMENT_DISABLED_FOR_TEST || (typeof item.isPaid === 'boolean' ? item.isPaid : (recordType === 'unlock_event'))
    const statusText = PAYMENT_DISABLED_FOR_TEST ? '已解锁' : (item.statusText || (isPaid ? '已解锁' : '未解锁'))
    const inputTags = this.buildHistoryTags(item)
    const metaLine = joinText([
      item.province,
      item.scoreLevel || item.collegeLevel,
      item.careerPlan
    ])
    const abilityLine = joinText([
      item.selectedSubjectText,
      item.mbti,
      item.interest
    ], ' / ')

    return {
      ...item,
      recordType,
      sourceId,
      recordId: resultId,
      resultId,
      functionId,
      title: trimText(title, 32),
      metaLine: metaLine || '点击查看本次 AI 分析报告',
      abilityLine,
      summarySnippet: trimText(item.summarySnippet || item.summary || '', 72),
      inputTags,
      isPaid,
      statusText,
      time,
      timeStr: this.formatTime(time),
      timeShort: this.formatShortTime(time)
    }
  },

  buildHistoryTags(item) {
    const source = Array.isArray(item.inputTags) ? item.inputTags : [
      item.province,
      item.scoreLevel || item.collegeLevel,
      item.selectedSubjectText,
      item.mbti,
      item.interest,
      item.careerPlan
    ]
    return source
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
      .slice(0, 4)
  },

  buildHistoryDisplayList(records) {
    let lastGroup = ''
    return records.map((item) => {
      const dateGroup = this.formatDateGroup(item.time)
      const showDateGroup = dateGroup !== lastGroup
      lastGroup = dateGroup
      return {
        ...item,
        dateGroup,
        showDateGroup
      }
    })
  },

  formatTime(value) {
    let source = value
    if (value && typeof value === 'object' && value.$date) {
      source = value.$date
    }
    const date = source instanceof Date ? source : new Date(source)
    if (Number.isNaN(date.getTime())) {
      return '--'
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  formatShortTime(value) {
    let source = value
    if (value && typeof value === 'object' && value.$date) {
      source = value.$date
    }
    const date = source instanceof Date ? source : new Date(source)
    if (Number.isNaN(date.getTime())) {
      return '--:--'
    }
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${hour}:${minute}`
  },

  formatDateGroup(value) {
    let source = value
    if (value && typeof value === 'object' && value.$date) {
      source = value.$date
    }
    const date = source instanceof Date ? source : new Date(source)
    if (Number.isNaN(date.getTime())) {
      return '未知日期'
    }

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayDiff = Math.round((todayStart - targetStart) / 86400000)

    if (dayDiff === 0) return '今天'
    if (dayDiff === 1) return '昨天'
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${year}年${month}月${day}日`
  },

  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      'userInfo.avatarUrl': avatarUrl,
      needSave: true
    })
  },

  onNicknameChange(e) {
    const nickName = e.detail.value
    this.setData({
      'userInfo.nickName': nickName,
      needSave: true
    })
  },

  onNicknameBlur(e) {
    const nickName = e.detail.value
    this.setData({
      'userInfo.nickName': nickName
    })
  },

  async saveUserInfo() {
    const { userInfo } = this.data
    if (!userInfo.avatarUrl && !userInfo.nickName) {
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      let finalAvatarUrl = userInfo.avatarUrl
      if (finalAvatarUrl && !finalAvatarUrl.startsWith('cloud://')) {
        const cloudPath = `avatars/${this.data.openid}_${Date.now()}.png`
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: finalAvatarUrl
        })
        finalAvatarUrl = uploadRes.fileID
      }

      const res = await wx.cloud.callFunction({
        name: 'user_manage',
        data: {
          type: 'update',
          userInfo: {
            avatarUrl: finalAvatarUrl,
            nickName: userInfo.nickName
          }
        }
      })

      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.setData({
          needSave: false,
          'userInfo.avatarUrl': finalAvatarUrl
        })
      }
    } catch (err) {
      wx.hideLoading()
      console.error(err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  copyOpenId() {
    wx.setClipboardData({
      data: this.data.openid,
      success: () => {
        wx.showToast({ title: 'ID 已复制', icon: 'none' })
      }
    })
  },

  goToContact() {
    wx.navigateTo({
      url: '/pages/contact/contact'
    })
  },

  goToOrder() {
    wx.navigateTo({
      url: '/pages/order/order'
    })
  }
})
