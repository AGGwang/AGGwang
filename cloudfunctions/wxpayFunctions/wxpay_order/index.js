/**
 * 微信支付 - 下单
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  const { out_trade_no, amount, description, attach } = event;

  const res = await cloud.callFunction({
    name: 'cloudbase_module',
    data: {
      name: 'wxpay_order',
      data: {
        description: description || '7选3测评报告解锁',
        amount: {
          total: amount && amount.total ? parseInt(amount.total) : 1, // 确保为整数
          currency: 'CNY',
        },
        // 商户生成的订单号
        out_trade_no: out_trade_no || (Math.round(Math.random() * 10 ** 13) + Date.now()),
        // attach: attach || '', // 暂时注释掉，排查错误
        payer: {
          // 服务端云函数中直接获取当前用户openId
          openid: wxContext.OPENID,
        },
      },
    },
  });
  return res.result;
};