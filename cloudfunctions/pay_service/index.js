// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { recordId } = event
  
  // 注意：实际支付需要配置商户号 (MCHID) 并使用 cloud.cloudPay.unifiedOrder
  // 由于当前环境未配置商户号，这里返回模拟的支付成功参数
  // 开发者请在微信支付商户平台获取商户号，并绑定云环境
  
  /* 真实代码示例：
  const res = await cloud.cloudPay.unifiedOrder({
    "body" : "职业规划解锁",
    "outTradeNo" : recordId + '_' + Date.now(),
    "spbillCreateIp" : "127.0.0.1",
    "subMchId" : "YOUR_MCH_ID",
    "totalFee" : 599, // 单位分
    "envId": "cloud1-0g2coyy919fac611",
    "functionName": "pay_cb" // 支付回调云函数
  })
  return res
  */

  // 模拟返回
  return {
    success: true,
    mock: true, // 标记为模拟支付
    payment: {
      timeStamp: String(Date.now()),
      nonceStr: 'mock_nonceStr',
      package: 'prepay_id=mock_prepay_id',
      signType: 'MD5',
      paySign: 'mock_paySign'
    }
  }
}