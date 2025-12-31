// index.ts
Page({
  data: {
  },

  onLoad() {
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        value: 'pages/index/index'
      })
    }
  },

  async startAssessment() {
    // 首页点击开始分析前，先校验登录
    const { ensureLogin } = require('../../services/auth')
    try {
      wx.showLoading({ title: '准备中...' })
      await ensureLogin()
      wx.hideLoading()

      wx.navigateTo({
        url: '/pages/inputpage/inputpage'
      })
    } catch (err) {
      wx.hideLoading()
      console.error(err)
      // 登录失败提示已在 ensureLogin 中处理，此处可不处理或引导重试
    }
  }
})
