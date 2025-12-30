// pages/mine/mine.js
Page({
    data: {
        isLogged: false, // 是否已登录
        records: [],
        openid: '',
        userInfo: {
            avatarUrl: '',
            nickName: ''
        },
        needSave: false
    },

    onShow() {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({
                value: 'pages/mine/mine'
            })
        }

        // 检查本地是否有登录态
        const openid = wx.getStorageSync('openid')
        if (openid) {
            this.setData({ isLogged: true })
            this.loginAndFetchUser() // 刷新数据
            this.loadRecords()
        }
    },

    // 点击一键登录按钮
    async handleLogin() {
        wx.showLoading({ title: '登录中...' })
        await this.loginAndFetchUser()
        wx.hideLoading()
    },

    async loginAndFetchUser() {
        try {
            // 获取 OPENID 并尝试获取数据库中的用户信息
            const res = await wx.cloud.callFunction({
                name: 'user_manage',
                data: { type: 'login' }
            })

            if (res.result.success) {
                const user = res.result.userInfo

                // 登录成功，保存状态
                wx.setStorageSync('openid', user._openid)

                this.setData({
                    isLogged: true,
                    openid: user._openid,
                    userInfo: {
                        avatarUrl: user.avatarUrl || '',
                        nickName: user.nickName || ''
                    }
                })

                // 加载记录
                this.loadRecords()
            }
        } catch (err) {
            console.error('Login failed', err)
            wx.showToast({ title: '登录失败，请重试', icon: 'none' })
        }
    },

    handleLogout() {
        wx.showModal({
            title: '提示',
            content: '确定要退出登录吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.removeStorageSync('openid')
                    this.setData({
                        isLogged: false,
                        records: [],
                        openid: '',
                        userInfo: { avatarUrl: '', nickName: '' }
                    })
                }
            }
        })
    },

    async loadRecords() {
        // 如果没登录，不加载记录
        if (!this.data.isLogged) return

        try {
            const res = await wx.cloud.callFunction({
                name: 'get_user_records'
            })

            if (res.result.success) {
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
        }
    },

    // 1. 获取头像 (临时路径) -> 上传云存储 -> 获取 FileID
    async onChooseAvatar(e) {
        const { avatarUrl } = e.detail
        this.setData({
            'userInfo.avatarUrl': avatarUrl,
            needSave: true
        })
    },

    // 2. 获取昵称
    onNicknameChange(e) {
        const nickName = e.detail.value
        this.setData({
            'userInfo.nickName': nickName,
            needSave: true
        })
    },

    onNicknameBlur(e) {
        const nickName = e.detail.value
        this.setData({
            'userInfo.nickName': nickName
        })
    },

    // 3. 保存用户信息到云数据库
    async saveUserInfo() {
        const { userInfo } = this.data
        if (!userInfo.avatarUrl && !userInfo.nickName) return

        wx.showLoading({ title: '保存中...' })

        try {
            let finalAvatarUrl = userInfo.avatarUrl

            // 如果头像还是临时路径 (http://tmp/...), 则上传到云存储
            if (finalAvatarUrl && !finalAvatarUrl.startsWith('cloud://')) {
                const cloudPath = `avatars/${this.data.openid}_${Date.now()}.png`
                const uploadRes = await wx.cloud.uploadFile({
                    cloudPath,
                    filePath: finalAvatarUrl
                })
                finalAvatarUrl = uploadRes.fileID
            }

            // 更新数据库
            const res = await wx.cloud.callFunction({
                name: 'user_manage',
                data: {
                    type: 'update',
                    userInfo: {
                        avatarUrl: finalAvatarUrl,
                        nickName: userInfo.nickName
                    }
                }
            })

            wx.hideLoading()
            if (res.result.success) {
                wx.showToast({ title: '保存成功', icon: 'success' })
                this.setData({
                    needSave: false,
                    'userInfo.avatarUrl': finalAvatarUrl // 更新为云路径
                })
            }
        } catch (err) {
            wx.hideLoading()
            console.error(err)
            wx.showToast({ title: '保存失败', icon: 'none' })
        }
    },

    copyOpenId() {
        wx.setClipboardData({
            data: this.data.openid,
            success: () => {
                wx.showToast({ title: 'ID 已复制', icon: 'none' })
            }
        })
    },

    goToResult(e) {
        const id = e.currentTarget.dataset.id
        wx.navigateTo({
            url: `/pages/result/result?id=${id}`
        })
    }
})