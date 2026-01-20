/**
 * 支付服务模块
 * 封装小程序支付相关功能
 */

/**
 * 发起支付
 * @param {string} recordId - 记录ID
 * @returns {Promise<{success: boolean, mock?: boolean, errMsg?: string}>}
 */
export async function requestPayment(recordId) {
  try {
    // 1. 调用云函数创建支付订单
    wx.showLoading({ title: '正在创建订单...' })
    
    const res = await wx.cloud.callFunction({
      name: 'pay_service',
      data: { recordId }
    })

    wx.hideLoading()

    if (!res.result.success) {
      throw new Error(res.result.errMsg || '创建订单失败')
    }

    // 2. 如果是模拟支付，直接返回成功
    if (res.result.mock) {
      console.log('[支付] 模拟支付模式')
      
      // 模拟支付延迟
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 直接调用解锁接口
      const unlockRes = await wx.cloud.callFunction({
        name: 'unlock_record',
        data: { recordId }
      })

      if (unlockRes.result.success) {
        return {
          success: true,
          mock: true,
          message: '模拟支付成功，报告已解锁'
        }
      } else {
        throw new Error('解锁报告失败')
      }
    }

    // 3. 真实支付：调用微信支付
    const { payment, outTradeNo } = res.result

    console.log('[支付] 发起微信支付:', outTradeNo)

    // 调用微信支付API
    await wx.requestPayment({
      timeStamp: payment.timeStamp,
      nonceStr: payment.nonceStr,
      package: payment.package,
      signType: payment.signType,
      paySign: payment.paySign
    })

    console.log('[支付] 支付成功')

    // 支付成功，等待回调处理
    // 可以轮询检查订单状态或直接返回
    return {
      success: true,
      mock: false,
      outTradeNo: outTradeNo,
      message: '支付成功，正在解锁报告...'
    }

  } catch (err) {
    console.error('[支付] 支付失败:', err)

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
 * 查询订单状态
 * @param {string} outTradeNo - 商户订单号
 * @returns {Promise<{success: boolean, status?: string, errMsg?: string}>}
 */
export async function queryOrderStatus(outTradeNo) {
  try {
    const db = wx.cloud.database()
    const res = await db.collection('orders')
      .where({
        outTradeNo: outTradeNo
      })
      .get()

    if (res.data.length === 0) {
      return {
        success: false,
        errMsg: '订单不存在'
      }
    }

    const order = res.data[0]
    return {
      success: true,
      status: order.status,
      order: order
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
 * 轮询检查支付结果
 * @param {string} outTradeNo - 商户订单号
 * @param {number} maxRetries - 最大重试次数
 * @param {number} interval - 轮询间隔（毫秒）
 * @returns {Promise<{success: boolean, paid?: boolean, errMsg?: string}>}
 */
export async function pollPaymentResult(outTradeNo, maxRetries = 10, interval = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, interval))

    const result = await queryOrderStatus(outTradeNo)
    
    if (result.success && result.status === 'SUCCESS') {
      return {
        success: true,
        paid: true
      }
    }

    if (result.success && result.status === 'FAILED') {
      return {
        success: false,
        paid: false,
        errMsg: '支付失败'
      }
    }
  }

  return {
    success: false,
    errMsg: '支付结果确认超时，请稍后查看'
  }
}

/**
 * 完整的支付流程（包含结果轮询）
 * @param {string} recordId - 记录ID
 * @returns {Promise<{success: boolean, mock?: boolean, errMsg?: string}>}
 */
export async function payAndWaitResult(recordId) {
  // 发起支付
  const payResult = await requestPayment(recordId)

  if (!payResult.success) {
    return payResult
  }

  // 如果是模拟支付，直接返回
  if (payResult.mock) {
    return payResult
  }

  // 真实支付：轮询检查结果
  wx.showLoading({ title: '正在确认支付结果...' })

  const pollResult = await pollPaymentResult(payResult.outTradeNo)

  wx.hideLoading()

  if (pollResult.success && pollResult.paid) {
    return {
      success: true,
      message: '支付成功，报告已解锁'
    }
  }

  return {
    success: false,
    errMsg: pollResult.errMsg || '支付结果确认失败'
  }
}
