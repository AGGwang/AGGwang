Page({
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        value: 'pages/index/index'
      })
    }
  },

  async startAssessment() {
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
    }
  }
})
