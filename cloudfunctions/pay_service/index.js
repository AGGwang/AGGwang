// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 创建支付订单（开发环境返回模拟支付）
 * @param {{recordId:string}} event
 * @returns {{success:boolean, mock:boolean, payment?:object, errMsg?:string}}
 */
exports.main = async (event, context) => {
  const { recordId } = event
  try {
    // 如果未接入真实商户，这里返回模拟支付
    return {
      success: true,
      mock: true,
    }
  } catch (err) {
    console.error(err)
    return { success: false, errMsg: err.message }
  }
}

