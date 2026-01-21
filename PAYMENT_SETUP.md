# 微信支付接入配置指南（官方 wx-pay-v2 模板）

本文档说明如何使用腾讯云官方提供的微信支付模板接入支付功能。

## ✅ 当前状态

**真实支付已启用！**

- ✅ 官方 `wxpayFunctions` 云函数已部署
- ✅ `orders` 数据库集合已创建
- ✅ 支付服务已配置为真实支付模式
- ✅ 小程序端代码已集成

## 📋 官方模板介绍

官方模板地址：https://tcb.cloud.tencent.com/dev?envId=hischool7in3-6g95n1i3f4479bdc#/cloud-template/detail?appName=wx-pay-v2&solutionId=solution-1viOLxt0hksWpA

### 模板提供的功能

| 方法名 | 功能说明 |
|--------|----------|
| `wxpay_order` | 小程序下单 |
| `wxpay_query_order_by_transaction_id` | 微信支付订单号查询订单 |
| `wxpay_query_order_by_out_trade_no` | 商户订单号查询订单 |
| `wxpay_refund` | 申请退款 |
| `wxpay_refund_query` | 通过商户退款单号查询单笔退款 |

## 🔧 支付配置

### 当前配置（miniprogram/services/payment.js）

```javascript
const PAY_CONFIG = {
  // 报告解锁价格（单位：分，100 = 1元）
  reportPrice: 100,
  // 商品描述
  description: '7选3测评报告解锁',
  // 真实支付已启用
  enableMockPay: false
}
```

### 修改价格

如需修改报告价格，编辑 `miniprogram/services/payment.js` 中的 `reportPrice` 值：

```javascript
// 例如：设置为 9.9 元
reportPrice: 990,  // 单位：分
```

## 🧪 测试支付

### 测试步骤

1. 在微信开发者工具中编译项目
2. 使用真机预览（支付功能需要真机测试）
3. 生成一份测评报告
4. 点击"解锁完整报告"按钮
5. 完成微信支付
6. 验证报告是否成功解锁

### 测试检查清单

- [ ] 点击支付按钮能正常调起微信支付
- [ ] 支付成功后报告自动解锁
- [ ] 订单信息保存到 `orders` 集合
- [ ] 取消支付时显示正确提示

## 📊 数据库结构

### orders 集合

```javascript
{
  _id: "订单ID（自动生成）",
  _openid: "用户OpenID",
  recordId: "关联的报告记录ID",
  outTradeNo: "商户订单号",
  totalFee: 100, // 支付金额（分）
  status: "SUCCESS", // 订单状态
  createTime: "创建时间",
  updateTime: "更新时间"
}
```

## 🔍 调试技巧

### 查看支付日志

在微信开发者工具的控制台中，可以看到以下日志：

```
[支付] 调用 wxpayFunctions 下单 {...}
[支付] 下单结果: {...}
[支付] 支付参数: {...}
[支付] 支付成功
[订单] 保存订单成功
```

### 查看云函数日志

1. 打开云开发控制台
2. 进入「云函数」->「wxpayFunctions」
3. 点击「日志」查看执行记录

### 常见问题

**Q1: 支付时提示"商户参数错误"**
- 检查商户号是否正确配置
- 确认小程序与商户号已绑定

**Q2: 支付成功但报告未解锁**
- 检查 `unlock_record` 云函数是否正常
- 查看云函数日志排查问题

**Q3: 调用云函数报错**
- 确认 `wxpayFunctions` 云函数已部署
- 检查云函数权限配置

## 🗑️ 可删除的旧文件

以下是之前创建的自定义支付云函数，使用官方模板后可以删除：

```
cloudfunctions/pay_service/          # 整个目录
cloudfunctions/pay_callback/         # 整个目录
```

### 删除命令

Windows:
```cmd
rmdir /s /q cloudfunctions\pay_service
rmdir /s /q cloudfunctions\pay_callback
```

Mac/Linux:
```bash
rm -rf cloudfunctions/pay_service
rm -rf cloudfunctions/pay_callback
```

## 📱 用户支付流程

```
1. 用户生成测评报告（免费预览200字）
         ↓
2. 点击"解锁完整报告"按钮
         ↓
3. 调用 wxpayFunctions 创建订单
         ↓
4. 调起微信支付界面
         ↓
5. 用户完成支付
         ↓
6. 调用 unlock_record 解锁报告
         ↓
7. 显示完整报告内容
```

## ⚠️ 注意事项

1. **真机测试**：支付功能必须在真机上测试，模拟器无法调起支付
2. **金额单位**：微信支付金额单位为"分"，100分 = 1元
3. **订单号唯一**：每次支付都会生成唯一的商户订单号
4. **支付回调**：官方模板会自动处理支付回调

## 📞 技术支持

如遇到问题：
1. 查看云函数日志
2. 检查数据库订单记录
3. 参考微信支付官方文档：https://pay.weixin.qq.com/wiki/doc/apiv3/wxpay/pages/index.shtml

---

**最后更新**：2026-01-21
**版本**：v2.1.0（真实支付已启用）
