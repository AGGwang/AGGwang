// pages/result/result.js
const aiService = require('../../services/ai')
const auth = require('../../services/auth')

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
        loading: true
    },

    onLoad(options) {
        if (options.id) {
            // 历史记录进入
            this.setData({ recordId: options.id })
            this.loadRecord(options.id)
        } else if (options.payload) {
            // 录入页新生成进入
            try {
                const payload = JSON.parse(decodeURIComponent(options.payload))
                this.startGeneration(payload)
            } catch (e) {
                console.error('Payload parse error', e)
                wx.showToast({ title: '参数错误', icon: 'none' })
            }
        }
    },

    // 加载已有记录
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
        } catch (err) {
            console.error(err)
            wx.showToast({ title: '加载记录失败', icon: 'none' })
            this.setData({ loading: false })
        }
    },

    // 开始新生成流程
    async startGeneration(payload) {
        const { targetCareer, scoreDetail, personalInfo, partialEndIndex = 240 } = payload

        // 生成前确保登录
        try { await auth.ensureLogin() } catch { return }

        this.setData({
            generating: true,
            loading: false,
            'record.targetCareer': targetCareer,
            'record.score': scoreDetail,
            'record.price': 5.99,
            'record.originalPrice': 19.9
        })

        let previewBuffer = ''

        try {
            // 1. 流式调用
            const fullText = await aiService.streamGenerateReport({
                targetCareer,
                scoreDetail,
                personalInfo,
                onText: (chunk) => {
                    previewBuffer += chunk
                    // 实时更新摘要，但限制长度不超过免费额度
                    const showText = previewBuffer.length > partialEndIndex
                        ? previewBuffer.substring(0, partialEndIndex) + '...'
                        : previewBuffer

                    this.setData({ 'record.summary': showText })
                }
            })

            // 2. 最终稳定内容生成（确保入库不乱码）
            const final = await aiService.generateFinalReport({ targetCareer, scoreDetail, personalInfo })

            // 3. 截断摘要，准备入库
            const summary = final.summary || (final.fullContent || '').substring(0, partialEndIndex)

            // 4. 更新页面数据
            // fullContent 存完整版，summary 存截断版
            // 界面根据 isPaid 切换显示
            this.setData({
                'record.fullContent': final.fullContent,
                'record.summary': summary,
                'record.isPaid': false
            })

            // 5. 写入数据库
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
            console.error('Generation failed', err)
            wx.showToast({ title: '生成失败，请重试', icon: 'none' })
        } finally {
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
                this.setData({
                    record: res.result.data,
                    isPaid: true
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