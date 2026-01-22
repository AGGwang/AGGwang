// pages/result/result.js
const aiService = require('../../services/ai')
const auth = require('../../services/auth')
const payment = require('../../services/payment')

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
            // 优先展示院校层次
            if (data.collegeLevel) {
                scoreList.push({ name: '目标院校层次', val: data.collegeLevel })
            }
            if (data.scoreDetail) {
                const parts = data.scoreDetail.split(',').map(s => s.trim())
                scoreList = scoreList.concat(parts.map(p => {
                    const [name, val] = p.split(':')
                    // 过滤掉已经在头部展示的院校层次
                    if (name && name.includes('院校层次')) return null
                    if (name && val) return { name: name.trim(), val: parseInt(val) || 0 }
                    return null
                }).filter(Boolean))
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
        // 优先展示院校层次
        if (collegeLevel) {
            scoreList.push({ name: '目标院校层次', val: collegeLevel })
        }
        if (scores) {
            scoreList = scoreList.concat(Object.keys(SUBJECT_MAP).map(key => ({
                name: SUBJECT_MAP[key],
                val: Number(scores[key]) || 0
            })).filter(item => item.val > 0))
        } else if (scoreDetail) {
            const parts = scoreDetail.split(',').map(s => s.trim())
            scoreList = scoreList.concat(parts.map(p => {
                const [name, val] = p.split(':')
                // 过滤掉可能存在的院校层次
                if (name && name.includes('院校层次')) return null
                if (name && val) return { name: name.trim(), val: parseInt(val) || 0 }
                return null
            }).filter(Boolean))
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
            console.log('Start saving record...')
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
            console.log('Save record response:', saveRes)

            if (saveRes?.result?.success) {
                this.setData({ recordId: saveRes.result.recordId })
            } else {
                console.error('Save record failed:', saveRes)
                wx.showToast({ title: '保存记录失败', icon: 'none' })
            }

        } catch (err) {
            console.error('Generation failed', err)
            wx.showToast({ title: '生成失败，请重试', icon: 'none' })
            this.setData({ generating: false })
        }
    },

    // 支付处理（使用新的支付服务）
    async handlePay() {
        if (!this.data.recordId) {
            wx.showToast({ title: '记录ID不存在', icon: 'none' })
            return
        }

        try {
            // 使用封装的支付服务
            const result = await payment.payAndWaitResult(this.data.recordId)

            if (result.success) {
                // 支付成功，刷新页面数据
                wx.showToast({ title: result.message || '支付成功', icon: 'success' })
                await this.loadRecord(this.data.recordId)
            } else if (result.cancelled) {
                // 用户取消支付
                wx.showToast({ title: '已取消支付', icon: 'none' })
            } else {
                // 支付失败
                wx.showModal({
                    title: '支付失败',
                    content: result.errMsg || '支付过程中出现问题，请重试',
                    showCancel: false
                })
            }
        } catch (err) {
            console.error('[支付] 异常:', err)
            wx.showModal({
                title: '支付异常',
                content: '支付过程中出现异常，请稍后重试',
                showCancel: false
            })
        }
    },

    // 支付成功回调（保留用于兼容性）
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
                    success(res) { },
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
