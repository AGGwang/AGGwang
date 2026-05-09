// pages/order/order.js
Page({
  data: {
    orders: [],
    loading: true
  },

  onLoad() {
    this.fetchOrders()
  },

  onPullDownRefresh() {
    this.fetchOrders().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async fetchOrders() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'get_user_orders'
      })

      if (res.result.success) {
        const orders = res.result.data.map(item => {
          return {
            ...item,
            createTimeStr: this.formatTime(item.createTime),
            priceStr: (item.totalFee / 100).toFixed(2)
          }
        })
        this.setData({ orders })
      } else {
        wx.showToast({
          title: '获取订单失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error(err)
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
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
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  },

  goToReport(e) {
    const recordId = e.currentTarget.dataset.id
    if (recordId) {
      wx.navigateTo({
        url: `/pages/result/result?id=${recordId}`
      })
    }
  }
})
