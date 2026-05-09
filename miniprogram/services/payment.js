/**
 * 支付服务模块 - 基于官方 wx-pay-v2 模板
 * 
 * 官方模板提供的云函数：wxpayFunctions
 * 包含方法：
 * - wxpay_order: 小程序下单
 * - wxpay_query_order_by_transaction_id: 微信支付订单号查询订单
 * - wxpay_query_order_by_out_trade_no: 商户订单号查询订单
 * - wxpay_refund: 申请退款
 * - wxpay_refund_query: 通过商户退款单号查询单笔退款
 */

// 支付配置
const PAY_CONFIG = {
  reportPrice: 599,
  description: '职业与志愿分析报告解锁'
}

/**
 * 生成商户订单号
 * 格式要求：6-32个字符，只能包含数字、字母、下划线
 * @param {string} recordId - 记录ID
 * @returns {string} 商户订单号
 */
function generateOutTradeNo(recordId) {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  // 确保订单号只包含数字和字母，长度在6-32之间
  const prefix = recordId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10)
  return `${prefix}${timestamp}${random}`
}

/**
 * 发起支付 - 使用官方 wxpayFunctions 云函数
 * @param {string} recordId - 记录ID
 * @returns {Promise<{success: boolean, mock?: boolean, errMsg?: string}>}
 */
export async function requestPayment(recordId, options = {}) {
  try {
    const outTradeNo = generateOutTradeNo(recordId)
    const totalFee = Number(options.totalFee || PAY_CONFIG.reportPrice)
    const description = options.description || PAY_CONFIG.description
    const attachData = options.attach || { recordId }
    const bizType = options.bizType || 'report_unlock'

    wx.showLoading({ title: '正在创建订单...' })

    console.log('[支付] 调用 wxpayFunctions 下单', {
      outTradeNo,
      totalFee,
      description
    })

    const res = await wx.cloud.callFunction({
      name: 'wxpayFunctions',
      data: {
        type: 'wxpay_order',
        out_trade_no: outTradeNo,
        amount: {
          total: totalFee,
          currency: 'CNY'
        },
        description: description,
        attach: JSON.stringify(attachData)
      }
    })

    wx.hideLoading()

    console.log('[支付] 下单结果:', JSON.stringify(res))

    if (!res.result) {
      console.error('[支付] 云函数返回为空:', res)
      throw new Error('云函数返回结果为空')
    }

    if (res.result.errCode !== 0 && res.result.code !== 0) {
      console.error('[支付] 云函数返回错误:', res.result)
      throw new Error(res.result.errMsg || res.result.msg || '创建订单失败')
    }

    const paymentData = res.result.data || res.result.payment || res.result

    if (!paymentData || (!paymentData.package && !paymentData.packageVal)) {
      console.error('[支付] 参数异常，完整返回:', JSON.stringify(res))
      throw new Error('支付参数缺失(package/packageVal)')
    }

    console.log('[支付] 支付参数:', JSON.stringify(paymentData))

    await wx.requestPayment({
      timeStamp: paymentData.timeStamp,
      nonceStr: paymentData.nonceStr,
      package: paymentData.package || paymentData.packageVal,
      signType: paymentData.signType || 'RSA',
      paySign: paymentData.paySign
    })

    console.log('[支付] 支付成功')

    // 保存订单信息到本地数据库
    await saveOrderToDatabase({
      recordId,
      outTradeNo,
      totalFee,
      description,
      bizType,
      status: 'SUCCESS'
    })

    return {
      success: true,
      mock: false,
      outTradeNo: outTradeNo,
      message: '支付成功'
    }

  } catch (err) {
    console.error('[支付] 支付失败:', err)
    wx.hideLoading()

    if (err.errMsg && err.errMsg.includes('cancel')) {
      return {
        success: false,
        cancelled: true,
        errMsg: '您已取消支付'
      }
    }

    return {
      success: false,
      errMsg: err.message || err.errMsg || '支付失败，请重试'
    }
  }
}

/**
 * 保存订单信息到数据库
 */
async function saveOrderToDatabase(orderInfo) {
  try {
    const db = wx.cloud.database()
    await db.collection('orders').add({
      data: {
        ...orderInfo,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    console.log('[订单] 保存订单成功')
  } catch (err) {
    console.error('[订单] 保存订单失败:', err)
  }
}

/**
 * 查询订单状态 - 使用官方模板
 * @param {string} outTradeNo - 商户订单号
 * @returns {Promise<{success: boolean, status?: string, errMsg?: string}>}
 */
export async function queryOrderStatus(outTradeNo) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'wxpayFunctions',
      data: {
        type: 'wxpay_query_order_by_out_trade_no',
        out_trade_no: outTradeNo
      }
    })

    console.log('[查询订单] 结果:', JSON.stringify(res))

    if (res.result && (res.result.errCode === 0 || res.result.code === 0)) {
      const orderData = res.result.data
      return {
        success: true,
        status: orderData.trade_state || orderData.tradeState,
        order: orderData
      }
    }

    return {
      success: false,
      errMsg: res.result?.errMsg || res.result?.msg || '查询订单失败'
    }

  } catch (err) {
    console.error('[查询订单] 失败:', err)
    return {
      success: false,
      errMsg: err.message || '查询订单失败'
    }
  }
}

/**
 * 申请退款 - 使用官方模板
 * @param {string} outTradeNo - 商户订单号
 * @param {number} refundFee - 退款金额（分）
 * @param {string} reason - 退款原因
 * @returns {Promise<{success: boolean, errMsg?: string}>}
 */
export async function requestRefund(outTradeNo, refundFee, reason = '用户申请退款') {
  try {
    const outRefundNo = `RF${Date.now()}${Math.floor(Math.random() * 1000)}`

    const res = await wx.cloud.callFunction({
      name: 'wxpayFunctions',
      data: {
        type: 'wxpay_refund',
        out_trade_no: outTradeNo,
        out_refund_no: outRefundNo,
        amount: {
          refund: refundFee,
          total: PAY_CONFIG.reportPrice,
          currency: 'CNY'
        },
        reason: reason
      }
    })

    console.log('[退款] 结果:', JSON.stringify(res))

    if (res.result && (res.result.errCode === 0 || res.result.code === 0)) {
      return {
        success: true,
        outRefundNo: outRefundNo,
        message: '退款申请已提交'
      }
    }

    return {
      success: false,
      errMsg: res.result?.errMsg || res.result?.msg || '退款申请失败'
    }

  } catch (err) {
    console.error('[退款] 失败:', err)
    return {
      success: false,
      errMsg: err.message || '退款申请失败'
    }
  }
}

/**
 * 完整的支付流程（包含解锁报告）
 * @param {string} recordId - 记录ID
 * @returns {Promise<{success: boolean, mock?: boolean, errMsg?: string}>}
 */
export async function payAndWaitResult(recordId) {
  return payAndUnlock(recordId, {
    totalFee: PAY_CONFIG.reportPrice,
    description: PAY_CONFIG.description,
    unlockFunctionName: 'unlock_record',
    unlockData: { recordId },
    successMessage: '支付成功，报告已解锁',
    loadingText: '正在解锁报告...'
  })
}

export async function payAndUnlock(recordId, options = {}) {
  const payResult = await requestPayment(recordId, options)
  if (!payResult.success) {
    return payResult
  }

  const unlockFunctionName = options.unlockFunctionName || 'unlock_record'
  const unlockData = options.unlockData || { recordId }
  const successMessage = options.successMessage || '支付成功，内容已解锁'
  const loadingText = options.loadingText || '正在解锁内容...'

  wx.showLoading({ title: loadingText })

  try {
    const mergedUnlockData = {
      ...unlockData,
      outTradeNo: payResult.outTradeNo
    }
    const unlockRes = await wx.cloud.callFunction({
      name: unlockFunctionName,
      data: mergedUnlockData
    })
    wx.hideLoading()
    if (unlockRes?.result?.success) {
      return { success: true, message: successMessage, outTradeNo: payResult.outTradeNo }
    }
    return {
      success: true,
      message: '支付成功，内容解锁处理中，请稍后刷新查看',
      outTradeNo: payResult.outTradeNo
    }
  } catch (err) {
    wx.hideLoading()
    return {
      success: true,
      message: '支付成功，内容解锁处理中，请稍后刷新查看',
      outTradeNo: payResult.outTradeNo
    }
  }
}

/**
 * 获取支付配置
 */
export function getPayConfig() {
  return { ...PAY_CONFIG }
}

/**
 * 设置报告价格
 * @param {number} price - 价格（单位：分）
 */
export function setReportPrice(price) {
  PAY_CONFIG.reportPrice = price
}
