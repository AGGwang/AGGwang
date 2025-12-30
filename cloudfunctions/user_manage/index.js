// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // event.type: 'login' | 'update'
    // event.userInfo: { avatarUrl, nickName } (for update)

    const { type, userInfo } = event

    try {
        const userRes = await db.collection('users').where({
            _openid: openid
        }).get()

        let userData = null

        if (userRes.data.length === 0) {
            // Create new user
            const newUser = {
                _openid: openid,
                nickName: '微信用户',
                avatarUrl: '', // Empty initially
                createTime: db.serverDate(),
                updateTime: db.serverDate()
            }
            await db.collection('users').add({
                data: newUser
            })
            userData = newUser
        } else {
            userData = userRes.data[0]
        }

        // Update if requested
        if (type === 'update' && userInfo) {
            await db.collection('users').where({
                _openid: openid
            }).update({
                data: {
                    ...userInfo,
                    updateTime: db.serverDate()
                }
            })
            // Merge updates for return
            userData = { ...userData, ...userInfo }
        }

        return {
            success: true,
            userInfo: userData
        }

    } catch (err) {
        console.error(err)
        return {
            success: false,
            errMsg: err.message
        }
    }
}