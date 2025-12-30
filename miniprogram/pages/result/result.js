// pages/result/result.js
Page({
  data: {
    recordId: '',
    record: null,
    isPaid: false,
    loading: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ recordId: options.id })
      this.loadRecord(options.id)
    }
  },

  async loadRecord(id) {
    const db = wx.cloud.database()
    try {
      const res = await db.collection('records').doc(id).get()
      this.setData({
        record: res.data,
        isPaid: res.data.isPaid,
        loading: false
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async handlePay() {
    const { recordId } = this.data
    wx.showLoading({ title: '创建订单...' })
    
    try {
      // 1. 调用云函数获取支付参数
      const res = await wx.cloud.callFunction({
        name: 'pay_service',
        data: { recordId }
      })

      const result = res.result
      
      if (!result.success) {
        throw new Error(result.errMsg || '订单创建失败')
      }

      // 如果是模拟支付 (Mock)
      if (result.mock) {
        wx.hideLoading()
        wx.showModal({
          title: '支付模拟',
          content: '当前为模拟环境，点击确定模拟支付成功',
          success: (res) => {
            if (res.confirm) {
              this.onPaySuccess()
            }
          }
        })
        return
      }

      // 2. 调起微信支付
      wx.requestPayment({
        ...result.payment,
        success: () => {
          this.onPaySuccess()
        },
        fail: (err) => {
          console.error('支付取消或失败', err)
          wx.hideLoading()
        }
      })

    } catch (err) {
      wx.hideLoading()
      console.error(err)
      wx.showToast({ title: err.message || '支付失败', icon: 'none' })
    }
  },

  // 支付成功后的逻辑
  async onPaySuccess() {
    wx.showLoading({ title: '解锁中...' })
    try {
      // 调用解锁云函数
      const res = await wx.cloud.callFunction({
        name: 'unlock_record',
        data: { recordId: this.data.recordId }
      })

      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '解锁成功', icon: 'success' })
        this.setData({
          record: res.result.data,
          isPaid: true
        })
      }
    } catch (err) {
      wx.hideLoading()
      console.error(err)
      wx.showToast({ title: '解锁同步失败，请刷新', icon: 'none' })
    }
  },

  // 开发测试用的直接解锁
  devUnlock() {
    this.onPaySuccess()
  }
})