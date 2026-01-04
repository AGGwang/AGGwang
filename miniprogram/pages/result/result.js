// pages/result/result.js
const aiService = require('../../services/ai')
const auth = require('../../services/auth')

const FREE_PREVIEW_LENGTH = 200 // 免费预览字数

Page({
    data: {
        recordId: '',
        record: {
            targetCareer: '',
            score: '',
            fullContent: '',
            summary: '',
            isPaid: false,
            price: 5.99,
            originalPrice: 19.9
        },
        isPaid: false,
        generating: false,
        loading: true,
        displayText: '' // 当前显示的文本
    },

    onLoad(options) {
        if (options.id) {
            this.setData({ recordId: options.id })
            this.loadRecord(options.id)
        } else if (options.payload) {
            try {
                const payload = JSON.parse(decodeURIComponent(options.payload))
                this.startGeneration(payload)
            } catch (e) {
                console.error('Payload parse error', e)
                wx.showToast({ title: '参数错误', icon: 'none' })
            }
        }
    },

    async loadRecord(id) {
        const db = wx.cloud.database()
        try {
            const res = await db.collection('records').doc(id).get()
            const data = res.data
            const displayText = data.isPaid
                ? data.fullContent
                : (data.fullContent || '').substring(0, FREE_PREVIEW_LENGTH) + '...'
            this.setData({
                record: data,
                isPaid: data.isPaid,
                displayText,
                loading: false
            })
        } catch (err) {
            console.error(err)
            wx.showToast({ title: '加载记录失败', icon: 'none' })
            this.setData({ loading: false })
        }
    },

    async startGeneration(payload) {
        const { targetCareer, scoreDetail, personalInfo } = payload

        try { await auth.ensureLogin() } catch { return }

        this.setData({
            generating: true,
            loading: false,
            'record.targetCareer': targetCareer,
            'record.score': scoreDetail,
            displayText: ''
        })

        let fullText = ''

        try {
            // 流式调用，实时显示前200字
            await aiService.streamGenerateReport({
                targetCareer,
                scoreDetail,
                personalInfo,
                onText: (chunk) => {
                    fullText += chunk
                    // 只显示前200字
                    const preview = fullText.length > FREE_PREVIEW_LENGTH
                        ? fullText.substring(0, FREE_PREVIEW_LENGTH) + '...'
                        : fullText
                    this.setData({ displayText: preview })
                }
            })

            // 生成完成，更新数据
            const summary = fullText.substring(0, FREE_PREVIEW_LENGTH)
            this.setData({
                'record.fullContent': fullText,
                'record.summary': summary,
                'record.isPaid': false,
                generating: false
            })

            // 写入数据库
            const saveRes = await wx.cloud.callFunction({
                name: 'records_write',
                data: {
                    targetCareer,
                    scoreDetail,
                    personalInfo,
                    fullContent: fullText,
                    summary,
                    partialEndIndex: FREE_PREVIEW_LENGTH
                }
            })

            if (saveRes?.result?.success) {
                this.setData({ recordId: saveRes.result.recordId })
            }

        } catch (err) {
            console.error('Generation failed', err)
            wx.showToast({ title: '生成失败，请重试', icon: 'none' })
            this.setData({ generating: false })
        }
    },

    // 支付处理
    async handlePay() {
        if (!this.data.recordId) return

        wx.showLoading({ title: '请求支付...' })
        try {
            const res = await wx.cloud.callFunction({
                name: 'pay_service',
                data: { recordId: this.data.recordId }
            })

            const result = res.result
            if (!result.success) throw new Error(result.errMsg || '支付请求失败')

            // 模拟支付逻辑
            if (result.mock) {
                wx.hideLoading()
                wx.showModal({
                    title: '支付模拟',
                    content: '点击确定模拟支付成功',
                    success: (res) => {
                        if (res.confirm) this.onPaySuccess()
                    }
                })
                return
            }

            // 真实支付调起
            wx.requestPayment({
                ...result.payment,
                success: () => this.onPaySuccess(),
                fail: (err) => {
                    console.error('Pay fail', err)
                    wx.hideLoading()
                }
            })
        } catch (err) {
            wx.hideLoading()
            console.error(err)
            wx.showToast({ title: '支付失败', icon: 'none' })
        }
    },

    // 支付成功回调
    async onPaySuccess() {
        wx.showLoading({ title: '解锁中...' })
        try {
            const res = await wx.cloud.callFunction({
                name: 'unlock_record',
                data: { recordId: this.data.recordId }
            })

            wx.hideLoading()
            if (res.result.success) {
                wx.showToast({ title: '解锁成功', icon: 'success' })
                const data = res.result.data
                this.setData({
                    record: data,
                    isPaid: true,
                    displayText: data.fullContent // 显示完整内容
                })
            }
        } catch (err) {
            wx.hideLoading()
            console.error(err)
            wx.showToast({ title: '解锁同步异常', icon: 'none' })
        }
    },

    // 开发测试入口
    devUnlock() {
        this.onPaySuccess()
    }
})
