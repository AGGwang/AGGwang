// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    const { recordId } = event

    try {
        // 更新记录状态为已支付
        // 注意：在实际生产中，这个函数应该只允许被支付回调调用，或者有严格的权限校验
        // 为了演示方便，这里允许前端调用
        await db.collection('records').doc(recordId).update({
            data: {
                isPaid: true,
                payTime: db.serverDate()
            }
        })

        // 获取完整记录返回给前端
        const res = await db.collection('records').doc(recordId).get()

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