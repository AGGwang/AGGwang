/**
 * 微信支付配置文件示例
 * 
 * 使用说明：
 * 1. 复制此文件为 config.js
 * 2. 填写您的商户号和API密钥
 * 3. config.js 已添加到 .gitignore，不会被提交到代码仓库
 */

module.exports = {
  // 小程序AppID（从 project.config.json 获取）
  appId: 'wxac9488bb13eb1b58',
  
  // 微信支付商户号（必填）
  // 在微信支付商户平台获取：https://pay.weixin.qq.com
  mchId: '1738355578',
  
  // 商户API密钥（必填）
  // 在微信支付商户平台设置：账户中心 -> API安全 -> API密钥
  apiKey: 'ZUSTOfGenicivil7In3LittappsWPaul',
  
  // 支付配置
  payConfig: {
    // 解锁报告的价格（单位：分，100 = 1元）
    reportPrice: 100,
    
    // 商品描述
    body: '7选3测评报告解锁',
    
    // 交易类型（固定值，小程序支付）
    tradeType: 'JSAPI',
    
    // 支付回调通知URL（云函数名称）
    notifyUrl: 'pay_callback'
  },
  
  // 是否启用真实支付（开发时可设为 false 使用模拟支付）
  enableRealPay: false,
  
  // 开发模式配置
  devMode: {
    // 是否输出详细日志
    verbose: true,
    
    // 模拟支付延迟（毫秒）
    mockPayDelay: 1000
  }
}
