# 微信支付接入配置指南

本文档详细说明如何配置和部署微信支付功能。

## 📋 前置条件

### 1. 微信支付商户号
- 访问 [微信支付商户平台](https://pay.weixin.qq.com)
- 完成商户号申请和认证
- 记录您的商户号（mch_id）

### 2. 小程序与商户号绑定
- 在微信支付商户平台：产品中心 -> AppID账号管理
- 添加您的小程序AppID：`wxac9488bb13eb1b58`
- 等待审核通过

### 3. 获取API密钥
- 在微信支付商户平台：账户中心 -> API安全
- 设置API密钥（32位字符串）
- **重要**：妥善保管密钥，不要泄露

## 🔧 配置步骤

### 步骤1：配置支付参数

编辑文件：`cloudfunctions/pay_service/config.js`

```javascript
module.exports = {
  // 小程序AppID（已自动填写）
  appId: 'wxac9488bb13eb1b58',
  
  // 【必填】微信支付商户号
  mchId: '1234567890', // 替换为您的商户号
  
  // 【必填】商户API密钥
  apiKey: 'YOUR_32_CHAR_API_KEY_HERE', // 替换为您的API密钥
  
  // 支付配置
  payConfig: {
    reportPrice: 100, // 报告价格（分），100 = 1元
    body: '7选3测评报告解锁',
    tradeType: 'JSAPI',
    notifyUrl: 'pay_callback'
  },
  
  // 【重要】启用真实支付
  enableRealPay: false, // 开发测试时设为 false，正式上线改为 true
  
  devMode: {
    verbose: true,
    mockPayDelay: 1000
  }
}
```

### 步骤2：部署云函数

#### 2.1 部署 pay_service 云函数

```bash
# 在微信开发者工具中
# 右键点击 cloudfunctions/pay_service
# 选择"上传并部署：云端安装依赖"
```

或使用命令行：
```bash
cd cloudfunctions/pay_service
npm install
# 然后在开发者工具中右键上传
```

#### 2.2 部署 pay_callback 云函数

```bash
# 在微信开发者工具中
# 右键点击 cloudfunctions/pay_callback
# 选择"上传并部署：云端安装依赖"
```

#### 2.3 验证部署

在云开发控制台 -> 云函数中，确认以下函数已部署：
- ✅ pay_service
- ✅ pay_callback
- ✅ unlock_record（已存在）

### 步骤3：创建订单数据库集合

在云开发控制台 -> 数据库中创建集合：

**集合名称**：`orders`

**权限设置**：
- 所有用户可读（用于查询订单状态）
- 仅创建者可写

**索引设置**（可选，提升查询性能）：
- 字段：`outTradeNo`，类型：升序
- 字段：`_openid`，类型：升序
- 字段：`status`，类型：升序

### 步骤4：配置云函数HTTP访问（可选）

如果需要通过HTTP接收支付回调：

1. 在云开发控制台 -> 云函数 -> pay_callback
2. 点击"函数配置"
3. 开启"HTTP访问服务"
4. 记录生成的访问路径

## 🧪 测试流程

### 开发环境测试（模拟支付）

1. 确保 `config.js` 中 `enableRealPay: false`
2. 在小程序中生成报告
3. 点击"解锁完整报告"
4. 系统会自动模拟支付并解锁

### 真实支付测试

1. 修改 `config.js` 中 `enableRealPay: true`
2. 重新部署 `pay_service` 云函数
3. 使用真实微信账号测试支付
4. 建议先设置较小金额（如1分）进行测试

**测试检查清单**：
- [ ] 能否正常创建订单
- [ ] 能否调起微信支付
- [ ] 支付成功后是否收到回调
- [ ] 报告是否正确解锁
- [ ] 订单状态是否正确更新

## 📊 数据库结构

### orders 集合字段说明

```javascript
{
  _id: "订单ID（自动生成）",
  _openid: "用户OpenID",
  recordId: "关联的报告记录ID",
  outTradeNo: "商户订单号（recordId_timestamp）",
  totalFee: 100, // 支付金额（分）
  body: "商品描述",
  status: "PENDING", // 订单状态：PENDING/SUCCESS/FAILED/CLOSED
  transactionId: "微信支付订单号（支付成功后填充）",
  createTime: "创建时间",
  updateTime: "更新时间",
  payTime: "支付完成时间",
  callbackData: {} // 支付回调原始数据
}
```

## 🔍 调试技巧

### 查看云函数日志

1. 云开发控制台 -> 云函数
2. 选择对应函数（pay_service 或 pay_callback）
3. 点击"日志"查看执行记录

### 常见问题排查

**问题1：调用 pay_service 返回错误**
- 检查商户号和API密钥是否正确
- 确认小程序已与商户号绑定
- 查看云函数日志获取详细错误信息

**问题2：支付成功但未解锁**
- 检查 pay_callback 云函数是否正确部署
- 查看 pay_callback 日志确认是否收到回调
- 检查 orders 集合中订单状态

**问题3：支付时提示"商户参数错误"**
- 确认 mchId 配置正确
- 确认小程序AppID与商户号已绑定
- 检查 API密钥是否正确

## 🔒 安全建议

1. **保护配置文件**
   - 将 `config.js` 添加到 `.gitignore`
   - 不要将密钥提交到代码仓库

2. **生产环境配置**
   - 使用环境变量管理敏感信息
   - 定期更换API密钥

3. **订单验证**
   - pay_callback 已实现幂等性检查
   - 防止重复处理同一订单

4. **金额校验**
   - 在回调中验证支付金额是否正确
   - 防止金额篡改

## 📱 小程序端使用

支付功能已集成到 `result` 页面，用户流程：

1. 生成报告（免费预览200字）
2. 点击"解锁完整报告"按钮
3. 调起微信支付
4. 支付成功后自动解锁

开发者无需额外配置小程序端代码。

## 🚀 上线前检查清单

- [ ] 商户号和API密钥已正确配置
- [ ] 小程序与商户号已绑定并审核通过
- [ ] 所有云函数已部署到生产环境
- [ ] orders 数据库集合已创建
- [ ] 已完成真实支付测试
- [ ] `enableRealPay` 已设置为 `true`
- [ ] 支付金额已设置为正式价格
- [ ] 已配置 `.gitignore` 保护敏感信息

## 📞 技术支持

如遇到问题，请：
1. 查看云函数日志
2. 检查数据库订单记录
3. 参考微信支付官方文档：https://pay.weixin.qq.com/wiki/doc/api/
4. 联系技术支持

---

**最后更新**：2026-01-20
**版本**：v1.0.0
