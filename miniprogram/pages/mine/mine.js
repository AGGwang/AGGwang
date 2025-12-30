// pages/mine/mine.js
Page({
    data: {
        records: [],
        openid: ''
    },

    onShow() {
        this.loadRecords()
    },

    async loadRecords() {
        wx.showLoading({ title: '加载中' })
        try {
            const res = await wx.cloud.callFunction({
                name: 'get_user_records'
            })

            if (res.result.success) {
                // 简单格式化时间
                const records = res.result.data.map((item) => {
                    return {
                        ...item,
                        createTimeStr: new Date(item.createTime).toLocaleDateString()
                    }
                })

                this.setData({ records })
            }
        } catch (err) {
            console.error(err)
        } finally {
            wx.hideLoading()
        }
    },

    goToResult(e) {
        const id = e.currentTarget.dataset.id
        wx.navigateTo({
            url: `/pages/result/result?id=${id}`
        })
    }
})