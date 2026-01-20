// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 微信支付回调处理
 * 当用户完成支付后，微信支付会调用此云函数
 * 
 * @param {object} event - 微信支付回调数据
 * @returns {object} 返回处理结果
 */
exports.main = async (event, context) => {
  console.log('[支付回调] 收到回调数据:', JSON.stringify(event))

  try {
    // 微信支付回调数据结构
    const {
      outTradeNo,      // 商户订单号
      resultCode,      // 支付结果：SUCCESS/FAIL
      totalFee,        // 支付金额（分）
      transactionId,   // 微信支付订单号
      timeEnd          // 支付完成时间
    } = event

    // 验证支付结果
    if (resultCode !== 'SUCCESS') {
      console.error('[支付回调] 支付失败:', event)
      
      // 更新订单状态为失败
      await updateOrderStatus(outTradeNo, 'FAILED', event)
      
      return {
        errcode: 0,
        errmsg: 'ok'
      }
    }

    // 从订单号中提取记录ID（格式：recordId_timestamp）
    const recordId = outTradeNo.split('_')[0]

    // 查询订单是否存在
    const orderRes = await db.collection('orders')
      .where({
        outTradeNo: outTradeNo
      })
      .get()

    if (orderRes.data.length === 0) {
      console.error('[支付回调] 订单不存在:', outTradeNo)
      return {
        errcode: -1,
        errmsg: '订单不存在'
      }
    }

    const order = orderRes.data[0]

    // 防止重复处理（幂等性检查）
    if (order.status === 'SUCCESS') {
      console.log('[支付回调] 订单已处理，跳过:', outTradeNo)
      return {
        errcode: 0,
        errmsg: 'ok'
      }
    }

    // 更新订单状态
    await db.collection('orders').doc(order._id).update({
      data: {
        status: 'SUCCESS',
        transactionId: transactionId,
        payTime: timeEnd,
        updateTime: db.serverDate(),
        callbackData: event
      }
    })

    console.log('[支付回调] 订单状态已更新为SUCCESS:', outTradeNo)

    // 解锁报告
    const unlockRes = await cloud.callFunction({
      name: 'unlock_record',
      data: {
        recordId: recordId
      }
    })

    if (unlockRes.result.success) {
      console.log('[支付回调] 报告解锁成功:', recordId)
    } else {
      console.error('[支付回调] 报告解锁失败:', unlockRes.result.errMsg)
      
      // 即使解锁失败，也返回成功，避免微信重复回调
      // 可以通过后台管理手动处理
    }

    // 返回成功响应给微信支付
    return {
      errcode: 0,
      errmsg: 'ok'
    }

  } catch (err) {
    console.error('[支付回调] 处理异常:', err)
    
    // 返回失败，微信会重试回调
    return {
      errcode: -1,
      errmsg: err.message
    }
  }
}

/**
 * 更新订单状态
 */
async function updateOrderStatus(outTradeNo, status, callbackData) {
  try {
    const res = await db.collection('orders')
      .where({
        outTradeNo: outTradeNo
      })
      .update({
        data: {
          status: status,
          updateTime: db.serverDate(),
          callbackData: callbackData
        }
      })
    
    console.log(`[订单更新] 订单 ${outTradeNo} 状态更新为 ${status}`)
    return res
  } catch (err) {
    console.error('[订单更新] 失败:', err)
    throw err
  }
}
