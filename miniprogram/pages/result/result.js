// pages/result/result.js
const aiService = require('../../services/ai')
const auth = require('../../services/auth')

const FREE_PREVIEW_LENGTH = 200 // 免费预览字数
const SUBJECT_MAP = {
    physics: '物理', chemistry: '化学', biology: '生物',
    politics: '政治', history: '历史', geography: '地理', technology: '技术'
}

Page({
    data: {
        recordId: '',
        record: {
            targetCareer: '',
            score: '',
            scoreList: [],
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

            // 解析分数详情
            let scoreList = []
            if (data.scoreDetail) {
                const parts = data.scoreDetail.split(',').map(s => s.trim())
                scoreList = parts.map(p => {
                    const [name, val] = p.split(':')
                    if (name && val) return { name: name.trim(), val: parseInt(val) || 0 }
                    return null
                }).filter(Boolean)
            }

            const displayText = data.isPaid
                ? data.fullContent
                : (data.fullContent || '').substring(0, FREE_PREVIEW_LENGTH) + '...'
            this.setData({
                record: { ...data, scoreList },
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
        const { targetCareer, scoreDetail, scores, personalInfo, collegeLevel } = payload

        try { await auth.ensureLogin() } catch { return }

        // 处理分数列表
        let scoreList = []
        if (scores) {
            scoreList = Object.keys(SUBJECT_MAP).map(key => ({
                name: SUBJECT_MAP[key],
                val: Number(scores[key]) || 0
            })).filter(item => item.val > 0)
        } else if (scoreDetail) {
            const parts = scoreDetail.split(',').map(s => s.trim())
            scoreList = parts.map(p => {
                const [name, val] = p.split(':')
                if (name && val) return { name: name.trim(), val: parseInt(val) || 0 }
                return null
            }).filter(Boolean)
        }

        this.setData({
            generating: true,
            loading: false,
            'record.targetCareer': targetCareer,
            'record.score': scoreDetail,
            'record.scoreList': scoreList,
            displayText: ''
        })

        let fullText = ''

        try {
            // 流式调用，实时显示前200字
            await aiService.streamGenerateReport({
                targetCareer,
                scoreDetail,
                personalInfo,
                collegeLevel, // 新增院校层次
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
                    collegeLevel, // 保存院校层次
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
    },

    /**
     * 联系专人规划
     * 获取企业微信联系方式并跳转
     */
    async handleContactExpert() {
        wx.showLoading({ title: '加载中...' })
        try {
            // 调用云函数获取企业微信链接/二维码
            const res = await wx.cloud.callFunction({
                name: 'get_contact_info', // 预留云函数名
                data: { type: 'expert_consult' }
            })
            
            wx.hideLoading()
            
            // 假设返回结构 { result: { url: 'https://work.weixin.qq.com/...' } }
            // 目前仅打印日志或提示，待实装
            console.log('Contact info:', res)
            
            if (res.result && res.result.url) {
                // 如果是链接，尝试打开客服会话或WebView
                wx.openCustomerServiceChat({
                    extInfo: { url: res.result.url },
                    corpId: 'YOUR_CORP_ID', // 企业ID
                    success(res) {},
                    fail(err) {
                        // 降级处理：复制微信号或弹窗
                        wx.setClipboardData({
                            data: 'expert_wechat_id',
                            success: () => wx.showToast({ title: '微信号已复制' })
                        })
                    }
                })
            } else {
                wx.showToast({ title: '功能即将上线', icon: 'none' })
            }
        } catch (err) {
            wx.hideLoading()
            console.error('Contact expert failed', err)
            // 这里的错误也可能是云函数未创建导致的，暂时提示敬请期待
            wx.showToast({ title: '功能即将上线', icon: 'none' })
        }
    }
})
