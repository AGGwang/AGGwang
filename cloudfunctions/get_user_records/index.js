// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()

    try {
        const res = await db.collection('records')
            .where({
                _openid: wxContext.OPENID
            })
            .orderBy('createTime', 'desc')
            .get()

        return {
            success: true,
            data: res.data
        }
    } catch (err) {
        console.error(err)
        return {
            success: false,
            errMsg: err.message
        }
    }
}