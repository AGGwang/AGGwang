// pages/result/result.js
const aiService = require('../../services/ai')
const auth = require('../../services/auth')
Page({
  data: {
    recordId: '',
    record: null,
    isPaid: false,
    loading: true,
    generating: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ recordId: options.id })
      this.loadRecord(options.id)
    } else if (options.payload) {
      const payload = JSON.parse(decodeURIComponent(options.payload))
      this.startGeneration(payload)
    }
  },

  async loadRecord(id) {
    const db = wx.cloud.database()
    try {
      const res = await db.collection('records').doc(id).get()
      const data = res.data

      this.setData({
        record: data,
        isPaid: data.isPaid,
        loading: false
      })

      // 如果未付费，对 summary 进行打字机效果展示
      // 如果已付费，直接显示 fullContent (也可以选择打字机效果，这里为了体验区分，已付费直接显示)
      if (!data.isPaid) {
        this.typewriterEffect(data.summary)
      } else {
        // 已付费，不需要特殊处理，wxml 中会直接显示 fullContent
      }

    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  /**
   * 启动前端流式生成，实时预览，并在完成后写库
   * @param {{targetCareer:string, scoreDetail:string, personalInfo:string, partialEndIndex:number}} payload
   */
  async startGeneration(payload) {
    const { targetCareer, scoreDetail, personalInfo, partialEndIndex = 240 } = payload
    // 生成前校验登录
    try { await auth.ensureLogin() } catch { return }
    this.setData({
      generating: true,
      loading: false,
      record: {
        targetCareer,
        score: scoreDetail,
        summary: '',
        fullContent: '',
        isPaid: false,
        price: 5.99,
        originalPrice: 19.9
      }
    })

    try {
      let preview = ''
      const fullText = await aiService.streamGenerateReport({
        targetCareer,
        scoreDetail,
        personalInfo,
        onText: (chunk) => {
          preview += chunk
          const show = preview.length > partialEndIndex ? preview.substring(0, partialEndIndex) + '...' : preview
          this.setData({ 'record.summary': show })
        }
      })

      // 调用非流式生成获取最终稳定的 JSON（用于写库，避免乱码）
      const final = await aiService.generateFinalReport({ targetCareer, scoreDetail, personalInfo })
      const summary = final.summary || (final.fullContent || '').substring(0, partialEndIndex)

      // 生成完成后，如果还没付费，更新 record.summary 确保其长度不超过 partialEndIndex
      // 同时 fullContent 保存完整内容，等待解锁后展示
      this.setData({
        'record.fullContent': final.fullContent,
        'record.summary': summary
      })

      const saveRes = await wx.cloud.callFunction({
        name: 'records_write',
        data: {
          targetCareer,
          scoreDetail,
          personalInfo,
          fullContent: final.fullContent,
          summary,
          partialEndIndex
        }
      })

      if (saveRes.result && saveRes.result.success) {
        this.setData({ recordId: saveRes.result.recordId })
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: err.message || '生成失败', icon: 'none' })
    } finally {
      this.setData({ generating: false })
    }
  },

  // 打字机效果模拟流式传输
  typewriterEffect(text) {
    if (!text) return

    // 先清空显示内容，准备逐字显示
    // 注意：我们需要在 data 中增加一个字段来专门显示打字机内容
    // 在 wxml 中，未付费时显示这个字段
    this.setData({
      'record.summary': ''
    })

    let i = 0
    const speed = 15 // 更快的打字速度
    const step = 3   // 每次输出更多字符以提升体感速度

    const timer = setInterval(() => {
      if (i < text.length) {
        this.setData({
          'record.summary': text.substring(0, Math.min(text.length, i + step))
        })
        i += step
      } else {
        clearInterval(timer)
      }
    }, speed)
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
