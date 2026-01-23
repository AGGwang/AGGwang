// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 1. 查询订单列表 (按时间倒序)
    const ordersRes = await db.collection('orders')
      .where({
        _openid: openid,
        status: 'SUCCESS' // 只显示成功的订单
      })
      .orderBy('createTime', 'desc')
      .limit(20) // 限制最近20条
      .get()

    const orders = ordersRes.data
    if (orders.length === 0) {
      return {
        success: true,
        data: []
      }
    }

    // 2. 提取 recordId 列表
    const recordIds = orders.map(order => order.recordId)

    // 3. 批量查询对应的记录详情 (获取商品名等)
    const recordsRes = await db.collection('records')
      .where({
        _id: _.in(recordIds)
      })
      .field({
        _id: true,
        targetCareer: true, // 只需要职业名称
        createTime: true
      })
      .get()
    
    const recordsMap = {}
    recordsRes.data.forEach(record => {
      recordsMap[record._id] = record
    })

    // 4. 合并数据
    const resultList = orders.map(order => {
      const record = recordsMap[order.recordId] || {}
      return {
        _id: order._id,
        outTradeNo: order.outTradeNo,
        totalFee: order.totalFee, // 单位：分
        createTime: order.createTime,
        status: order.status,
        targetCareer: record.targetCareer || '未知商品', // 商品名
        recordId: order.recordId
      }
    })

    return {
      success: true,
      data: resultList
    }

  } catch (err) {
    console.error('[get_user_orders] 失败', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}