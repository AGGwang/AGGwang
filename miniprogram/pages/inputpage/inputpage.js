// pages/inputpage/inputpage.js
Page({
    data: {
        targetCareer: '',
        score: '',
        personalInfo: ''
    },

    onInput(e) {
        const field = e.currentTarget.dataset.field
        this.setData({
            [field]: e.detail.value
        })
    },

    async submitForm() {
        const { targetCareer, score, personalInfo } = this.data

        if (!targetCareer || !score || !personalInfo) {
            wx.showToast({
                title: '请填写完整信息',
                icon: 'none'
            })
            return
        }

        wx.showLoading({
            title: 'AI 正在分析...',
            mask: true
        })

        try {
            const res = await wx.cloud.callFunction({
                name: 'ai_generate',
                data: {
                    targetCareer,
                    score,
                    personalInfo
                }
            })

            wx.hideLoading()

            if (res.result && res.result.success) {
                wx.navigateTo({
                    url: `/pages/result/result?id=${res.result.recordId}`
                })
            } else {
                throw new Error(res.result?.errMsg || '生成失败')
            }
        } catch (err) {
            wx.hideLoading()
            console.error(err)
            wx.showToast({
                title: '服务暂时不可用，请稍后重试',
                icon: 'none'
            })
        }
    }
})