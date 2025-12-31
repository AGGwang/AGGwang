## 方案概览
- 将 AI 调用迁移到小程序前端，使用 wx.cloud.extend.AI（官方示例方式）做流式生成；云函数仅负责数据入库与解锁。
- 在生成过程中实时展示“部分内容”（摘要/前 N 字），剩余内容进入数据库并需付费解锁。
- 统一改用混元模型：模型组 hunyuan-exp + 模型 hunyuan-t1-latest。

## 前端改造（使用 wx.cloud.extend.AI）
1. 新增服务文件：`miniprogram/services/ai.ts`
   - 导出 `streamGenerateReport(params)`：内部按官方示例
     - `const model = wx.cloud.extend.AI.createModel("hunyuan-exp")`
     - `const res = await model.streamText({ data: { model: "hunyuan-t1-latest", messages, temperature } })`
     - 遍历 `res.textStream` 累加 fullText，并通过回调/事件把增量文本返回给页面做打字机效果
     - 同时遍历 `res.eventStream` 做日志与 finish 状态判定
   - 函数级注释：说明入参（目标职业、各科分数、个人信息）与返回（增量文本事件/完成事件）

2. 页面改动：
   - `pages/inputpage/inputpage.js`
     - 点击“生成规划报告”后，直接调用 `streamGenerateReport`
     - 一边生成一边显示（打字机效果），但 UI 只保留前 N 字（如 200-300 字）作为免费预览
     - 完成后，调用云函数保存完整内容，拿到 `recordId`，跳转结果页
   - `pages/result/result.js/wxml`
     - 未付费：显示数据库中的 `summary`（或前 N 字），下方保留解锁栏；已付费：显示 `fullContent`
     - 维持现有支付与解锁逻辑

3. 交互细节：
   - “流式展示”：使用打字机效果显示 `summaryPreview`（前 N 字），其余内容不在前端展示
   - 加载状态：顶部 Loading 与进度条/生成中提示
   - 出错降级：AI 失败则提示原因（如模型未开通/超时），并允许重试

## 云函数改造（仅负责数据落库与解锁）
1. 新增云函数：`cloudfunctions/records_write`
   - 入参：`{ targetCareer, scoreDetail, personalInfo, fullContent, summary, partialEndIndex }`
   - 数据库写入：`records` 集合
   - 返回：`{ recordId }`
   - 函数级注释：说明字段与返回
2. 保留并完善：`unlock_record`、`get_user_records`、`pay_service`
   - `unlock_record`：将 `isPaid` 置 true 并返回最新记录
   - `get_user_records`：按 `_openid` 过滤、按 `createTime` 倒序
   - `pay_service`：真实支付参数（若未接入，保留模拟支付开关）

## 数据结构与收费策略
- `records`：
  - `_openid, targetCareer, scoreDetail, personalInfo`
  - `summary`（前 N 字摘要）
  - `fullContent`（完整 Markdown）
  - `partialEndIndex`（免费区间长度，默认 200-300）
  - `isPaid, price, originalPrice, createTime`
- 免费/付费分界以 `partialEndIndex` 控制；前端仅展示 `summary`，付费后替换为 `fullContent`

## 环境与依赖
- `miniprogram/app.ts` 保持 `env: 'cloud1-0g2coyy919fac611'`
- 前端基础库 >= 3.0.0，构建 npm 后可用 TDesign 与 AI 能力
- 云函数不再使用 `wx.cloud`（云端无 wx），仅前端使用 `wx.cloud.extend.AI`

## 验证与交付
1. 构建 npm；编译项目
2. 在录入页体验：生成时看到打字机效果的摘要预览；生成结束自动入库
3. 跳转结果页：未付费只显示摘要；支付或开发模拟后显示全文
4. 错误注释与日志：在 `ai.ts` 与云函数入口均加函数级注释与关键日志

## 需要您确认
- 是否同意将 AI 生成迁移到前端（官方推荐、避免云端 `wx` 未定义问题）
- 免费预览长度（默认 200-300 字）与价格（默认 5.99）
- 我据此开始修改并提交对应文件变更