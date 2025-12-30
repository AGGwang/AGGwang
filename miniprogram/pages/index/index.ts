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

  startAssessment() {
    wx.navigateTo({
      url: '/pages/inputpage/inputpage'
    })
  }
})
