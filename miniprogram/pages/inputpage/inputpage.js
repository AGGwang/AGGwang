// pages/inputpage/inputpage.js
const aiService = require('../../services/ai')
const auth = require('../../services/auth')
Page({
    data: {
        targetCareer: '',
        scores: {
            physics: '',
            chemistry: '',
            biology: '',
            politics: '',
            history: '',
            geography: '',
            technology: ''
        },
        personalInfo: ''
    },

    onInput(e) {
        const field = e.currentTarget.dataset.field
        this.setData({
            [field]: e.detail.value
        })
    },

    onScoreInput(e) {
        const subject = e.currentTarget.dataset.subject
        const value = e.detail.value
        this.setData({
            [`scores.${subject}`]: value
        })
    },

    /**
     * 提交并触发前端流式生成
     */
    async submitForm() {
        const { targetCareer, scores, personalInfo } = this.data

        // 检查是否至少填了3门分数 (或者检查总分，这里简化为检查是否有输入)
        const filledScores = Object.values(scores).filter(s => s && s.trim() !== '')
        if (filledScores.length < 3) {
            wx.showToast({
                title: '请至少填写3门科目分数',
                icon: 'none'
            })
            return
        }

        if (!targetCareer || !personalInfo) {
            wx.showToast({
                title: '请填写目标职业和个人简介',
                icon: 'none'
            })
            return
        }

        // 格式化分数信息字符串供AI使用
        const scoreStr = `
      物理: ${scores.physics || 0}, 
      化学: ${scores.chemistry || 0}, 
      生物: ${scores.biology || 0}, 
      政治: ${scores.politics || 0}, 
      历史: ${scores.history || 0}, 
      地理: ${scores.geography || 0}, 
      技术: ${scores.technology || 0}
    `

        try {
            // 生成前校验登录
            await auth.ensureLogin()
            const payload = encodeURIComponent(JSON.stringify({
                targetCareer,
                scoreDetail: scoreStr,
                personalInfo,
                partialEndIndex: 240
            }))
            wx.navigateTo({ url: `/pages/result/result?payload=${payload}` })
        } catch (err) {
            console.error(err)
            wx.showModal({
                title: '跳转失败',
                content: err.message || '请稍后重试',
                showCancel: false
            })
        }
    }
})
