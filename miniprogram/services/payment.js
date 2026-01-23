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
  // 报告解锁价格（单位：分，100 = 1元）
  reportPrice: 599,
  // 商品描述
  description: '7选3测评报告解锁'
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
export async function requestPayment(recordId) {
  try {
    // 生成商户订单号
    const outTradeNo = generateOutTradeNo(recordId)

    wx.showLoading({ title: '正在创建订单...' })

    console.log('[支付] 调用 wxpayFunctions 下单', {
      outTradeNo,
      totalFee: PAY_CONFIG.reportPrice,
      description: PAY_CONFIG.description
    })

    // 调用官方支付模板的云函数
    // 参数格式参考官方文档：https://docs.cloudbase.net/lowcode/practices/miniapp-guide/wx-pay
    const res = await wx.cloud.callFunction({
      name: 'wxpayFunctions',
      data: {
        // 调用下单方法
        type: 'wxpay_order',
        // 商户订单号（必填）
        out_trade_no: outTradeNo,
        // 订单金额（必填，单位：分）
        amount: {
          total: PAY_CONFIG.reportPrice,
          currency: 'CNY'
        },
        // 商品描述（必填）
        description: PAY_CONFIG.description,
        // 附加数据（可选，用于回调时识别订单）
        attach: JSON.stringify({ recordId: recordId })
      }
    })

    wx.hideLoading()

    console.log('[支付] 下单结果:', JSON.stringify(res))

    // 检查返回结果
    if (!res.result) {
      throw new Error('云函数返回结果为空')
    }

    // 官方模板返回格式：{ errCode: 0, errMsg: 'ok', data: {...} }
    if (res.result.errCode !== 0 && res.result.code !== 0) {
      throw new Error(res.result.errMsg || res.result.msg || '创建订单失败')
    }

    // 获取支付参数
    // 兼容不同的返回结构，有些模板可能将参数放在 payment 字段下
    const paymentData = res.result.data || res.result.payment || res.result

    // 检查关键参数：package 或 packageVal
    if (!paymentData || (!paymentData.package && !paymentData.packageVal)) {
      console.error('[支付] 参数异常，完整返回:', JSON.stringify(res))
      throw new Error('支付参数缺失(package/packageVal)')
    }

    console.log('[支付] 支付参数:', JSON.stringify(paymentData))

    // 调用微信支付API
    await wx.requestPayment({
      timeStamp: paymentData.timeStamp,
      nonceStr: paymentData.nonceStr,
      // 兼容 packageVal 和 package 字段
      package: paymentData.package || paymentData.packageVal,
      signType: paymentData.signType || 'RSA',
      paySign: paymentData.paySign
    })

    console.log('[支付] 支付成功')

    // 保存订单信息到本地数据库
    await saveOrderToDatabase({
      recordId,
      outTradeNo,
      totalFee: PAY_CONFIG.reportPrice,
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

    // 处理用户取消支付
    if (err.errMsg && err.errMsg.includes('cancel')) {
      return {
        success: false,
        cancelled: true,
        errMsg: '您已取消支付'
      }
    }

    // 其他错误
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
  // 发起支付
  const payResult = await requestPayment(recordId)

  if (!payResult.success) {
    return payResult
  }

  // 真实支付成功，解锁报告
  wx.showLoading({ title: '正在解锁报告...' })

  try {
    const unlockRes = await wx.cloud.callFunction({
      name: 'unlock_record',
      data: { recordId }
    })

    wx.hideLoading()

    if (unlockRes.result.success) {
      return {
        success: true,
        message: '支付成功，报告已解锁'
      }
    } else {
      // 支付成功但解锁失败，需要人工处理
      return {
        success: true,
        message: '支付成功，报告解锁中，请稍后刷新查看'
      }
    }
  } catch (err) {
    wx.hideLoading()
    return {
      success: true,
      message: '支付成功，报告解锁中，请稍后刷新查看'
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
