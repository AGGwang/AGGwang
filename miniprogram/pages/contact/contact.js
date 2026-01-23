Page({
  data: {},
  onLoad() {},

  copyEmail() {
    wx.setClipboardData({
      data: 'paul7in3wechat@outlook.com',
      success: () => {
        wx.showToast({
          title: '邮箱已复制',
          icon: 'success'
        })
      }
    })
  }
})