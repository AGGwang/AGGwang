// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 解锁报告（设置 isPaid 为 true 并返回最新记录）
 * @param {{recordId:string}} event
 * @returns {{success:boolean, data?:object, errMsg?:string}}
 */
exports.main = async (event, context) => {
    const { recordId } = event
    try {
        await db.collection('records').doc(recordId).update({
            data: { isPaid: true }
        })
        const res = await db.collection('records').doc(recordId).get()
        return { success: true, data: res.data }
    } catch (err) {
        console.error(err)
        return { success: false, errMsg: err.message }
    }
}

