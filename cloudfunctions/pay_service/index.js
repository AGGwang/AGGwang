// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const config = require('./config')

/**
 * 创建支付订单
 * @param {{recordId:string}} event
 * @returns {{success:boolean, mock:boolean, payment?:object, errMsg?:string}}
 */
exports.main = async (event, context) => {
  const { recordId } = event
  const { OPENID } = cloud.getWXContext()

  try {
    // 验证记录是否存在
    const recordRes = await db.collection('records').doc(recordId).get()
    if (!recordRes.data) {
      return { success: false, errMsg: '记录不存在' }
    }

    const record = recordRes.data

    // 检查是否已支付
    if (record.isPaid) {
      return { success: false, errMsg: '该报告已解锁，无需重复支付' }
    }

    // 如果未启用真实支付，返回模拟支付
    if (!config.enableRealPay) {
      console.log('[模拟支付] 返回模拟支付数据')
      return {
        success: true,
        mock: true,
        message: '当前为开发模式，使用模拟支付'
      }
    }

    // 生成商户订单号（使用记录ID + 时间戳确保唯一性）
    const outTradeNo = `${recordId}_${Date.now()}`

    // 调用云开发微信支付统一下单接口
    const paymentResult = await cloud.cloudPay.unifiedOrder({
      body: config.payConfig.body,
      outTradeNo: outTradeNo,
      totalFee: config.payConfig.reportPrice,
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: config.payConfig.notifyUrl,
      subMchId: config.mchId,
      tradeType: config.payConfig.tradeType,
      openid: OPENID
    })

    if (config.devMode.verbose) {
      console.log('[支付] 统一下单结果:', JSON.stringify(paymentResult))
    }

    // 保存订单信息到数据库
    await db.collection('orders').add({
      data: {
        _openid: OPENID,
        recordId: recordId,
        outTradeNo: outTradeNo,
        totalFee: config.payConfig.reportPrice,
        body: config.payConfig.body,
        status: 'PENDING', // PENDING, SUCCESS, FAILED, CLOSED
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    // 返回支付参数给小程序端
    return {
      success: true,
      mock: false,
      payment: paymentResult.payment,
      outTradeNo: outTradeNo
    }

  } catch (err) {
    console.error('[支付错误]', err)
    return {
      success: false,
      errMsg: err.message || '支付服务异常，请稍后重试'
    }
  }
}
