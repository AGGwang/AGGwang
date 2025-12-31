// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 构建提示词
 * @param {string} targetCareer 目标职业
 * @param {string} score 各科分数详情
 * @param {string} personalInfo 个人情况简介
 * @returns {string} 大模型输入提示词
 */
function buildPrompt(targetCareer, score, personalInfo) {
  return `
你是一位资深的高考志愿填报与职业规划专家。
请根据以下学生信息生成一份详细的职业规划报告。

【学生信息】
- 目标职业：${targetCareer}
- 各科分数情况：${score}
- 个人情况：${personalInfo}

【输出要求】
请严格按照 JSON 格式返回，不要包含 markdown 代码块标记（如 \`\`\`json），包含以下两个字段：
1. "fullContent": string 类型。一份完整的 Markdown 格式报告，包含"现状分析"（结合各科分数优劣势）、"选科推荐"（基于分数以及大学职业选科限制要求提出最优3门组合）、"详细学习路径"（分阶段）、"未来职业前景"。
2. "summary": string 类型。一份报告摘要，Markdown 格式，简要包含现状和选科推荐，并在末尾提示"(更多详细学习路径及职业前景分析请解锁查看)"。

请确保内容专业、客观且具有指导意义。
  `
}

/**
 * 以官方示例方式（streamText + textStream/eventStream）调用混元模型生成报告
 * @param {string} targetCareer 目标职业
 * @param {string} score 各科分数详情字符串
 * @param {string} personalInfo 个人情况描述
 * @returns {Promise<{fullContent: string, summary: string}>} AI 生成的完整报告和摘要
 */
async function callAI(targetCareer, score, personalInfo) {
  const ai = cloud.extend && cloud.extend.AI
  if (!ai) {
    throw new Error('当前环境不支持 cloud.extend.AI，请升级 wx-server-sdk 或检查环境配置')
  }

  // 创建模型组并指定具体模型
  const model = ai.createModel('hunyuan-exp')
  const res = await model.streamText({
    data: {
      model: 'hunyuan-t1-latest',
      messages: [
        { role: 'user', content: buildPrompt(targetCareer, score, personalInfo) }
      ],
      temperature: 0.7
    }
  })

  // 接收文本流
  let fullText = ''
  for await (let str of res.textStream) {
    fullText += str
  }

  // 接收事件流（便于排障与统计），不影响业务返回
  for await (let event of res.eventStream) {
    // 可按需记录：finish_reason、usage 等
    console.log('AI Event:', event && event.type ? event.type : event)
  }

  // 解析 JSON 结构；若解析失败则降级
  try {
    const clean = fullText.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(clean)
    return {
      fullContent: parsed.fullContent,
      summary: parsed.summary
    }
  } catch (e) {
    console.warn('AI 返回非标准 JSON，采用降级处理', e)
    return {
      fullContent: fullText,
      summary: (fullText || '').substring(0, 200) + '\n\n(更多详细学习路径及职业前景分析请解锁查看)'
    }
  }
}

/**
 * 云函数入口：生成报告并落库，返回摘要与记录ID
 * @param {{targetCareer:string, score:string, personalInfo:string}} event 入参
 * @returns {{success:boolean, recordId?:string, summary?:string, price?:number, originalPrice?:number, errMsg?:string}}
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { targetCareer, score, personalInfo } = event

  try {
    const aiResult = await callAI(targetCareer, score, personalInfo)

    const record = {
      _openid: wxContext.OPENID,
      targetCareer,
      score,
      personalInfo,
      fullContent: aiResult.fullContent,
      summary: aiResult.summary,
      isPaid: false,
      price: 5.99,
      originalPrice: 19.9,
      createTime: db.serverDate()
    }

    const addRes = await db.collection('records').add({ data: record })

    return {
      success: true,
      recordId: addRes._id,
      summary: aiResult.summary,
      price: record.price,
      originalPrice: record.originalPrice
    }
  } catch (err) {
    console.error('AI 生成失败:', err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}
