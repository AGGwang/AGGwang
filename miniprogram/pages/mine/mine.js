Page({
  data: {
    isLogged: false,
    historyRecords: [],
    historyKeyword: '',
    historyPage: 1,
    historyPageSize: 10,
    historyHasMore: true,
    historyLoading: false,
    historyTotal: 0,
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
            historyKeyword: '',
            historyPage: 1,
            historyHasMore: true,
            historyLoading: false,
            historyTotal: 0,
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
          pageSize: this.data.historyPageSize,
          keyword: this.data.historyKeyword
        }
      })

      if (!res.result.success) {
        throw new Error(res.result.errMsg || '获取历史记录失败')
      }

      const list = (res.result.data || []).map((item) => this.normalizeHistoryItem(item))
      const merged = reset ? list : this.data.historyRecords.concat(list)

      this.setData({
        historyRecords: merged,
        historyPage: page + 1,
        historyHasMore: !!res.result.hasMore,
        historyTotal: res.result.total || 0
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '历史记录加载失败', icon: 'none' })
    } finally {
      this.setData({ historyLoading: false })
    }
  },

  onHistoryKeywordInput(e) {
    this.setData({
      historyKeyword: e.detail.value
    })
  },

  handleHistorySearch() {
    this.loadHistoryRecords(true)
  },

  clearHistoryKeyword() {
    this.setData({ historyKeyword: '' })
    this.loadHistoryRecords(true)
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
    let title = item.title || item.targetCareer || item.featureName || '职业与志愿分析'
    if (!title) {
      title = '职业与志愿分析'
    }

    const time = item.time || item.createTime || item.unlockTime
    const isPaid = typeof item.isPaid === 'boolean' ? item.isPaid : (recordType === 'unlock_event')
    const statusText = item.statusText || (isPaid ? '已解锁' : '未解锁')

    return {
      ...item,
      recordType,
      sourceId,
      recordId: resultId,
      resultId,
      functionId,
      title,
      isPaid,
      statusText,
      time,
      timeStr: this.formatTime(time)
    }
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
