// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()

/**
 * 调用微信云开发 AI 能力生成职业规划报告
 * 
 * @param {string} targetCareer - 目标职业
 * @param {number} score - 分数
 * @param {string} personalInfo - 个人情况描述
 * @returns {Promise<{fullContent: string, summary: string}>} AI 生成的完整报告和摘要
 */
async function callAI(targetCareer, score, personalInfo) {
  try {
    // 1. 获取 AI 实例
    // 注意：请确保你的云环境已开通 AI 能力，并且 wx-server-sdk 为最新版本
    const ai = cloud.extend.AI
    if (!ai) {
      throw new Error('当前环境不支持 cloud.extend.AI，请升级 wx-server-sdk 或检查环境配置')
    }

    // 2. 指定模型
    // 'deepseek-r1' 仅为示例，请在微信云开发控制台 -> AI 能力中确认你已开通的模型 ID
    const modelName = 'deepseek-r1'
    const aiModel = ai.createModel(modelName)

    // 3. 构造 Prompt
    const prompt = `
你是一位资深的高考志愿填报与职业规划专家。
请根据以下学生信息生成一份详细的职业规划报告。

【学生信息】
- 目标职业：${targetCareer}
- 当前预估/实考分数：${score}
- 个人情况：${personalInfo}

【输出要求】
请严格按照 JSON 格式返回，不要包含 markdown 代码块标记（如 \`\`\`json），包含以下两个字段：
1. "fullContent": string 类型。一份完整的 Markdown 格式报告，包含"现状分析"、"选科推荐"（含首选组合和理由）、"详细学习路径"（分阶段）、"未来职业前景"。
2. "summary": string 类型。一份报告摘要，Markdown 格式，简要包含现状和选科推荐，并在末尾提示"(更多详细学习路径及职业前景分析请解锁查看)"。

请确保内容专业、客观且具有指导意义。
    `

    // 4. 调用生成
    const res = await aiModel.generateText({
      data: {
        model: modelName,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      }
    })

    console.log('AI Response:', res)

    // 5. 解析结果
    // 尝试解析 JSON，如果失败则进行容错处理
    let result
    try {
      // 某些模型可能会返回 ```json ... ``` 格式，需要清洗
      const cleanJson = typeof res === 'string' ? res.replace(/```json/g, '').replace(/```/g, '').trim() : JSON.stringify(res)

      // 如果 res 本身就是对象（取决于 SDK 版本），则直接使用
      if (typeof res === 'object' && res.choices && res.choices[0].message) {
        const content = res.choices[0].message.content
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim()
        result = JSON.parse(cleanContent)
      } else {
        result = JSON.parse(cleanJson)
      }
    } catch (e) {
      console.warn('AI 返回非标准 JSON，降级处理', e)
      const rawText = typeof res === 'string' ? res : JSON.stringify(res)
      result = {
        fullContent: rawText,
        summary: rawText.substring(0, 100) + '...\n\n(更多详细学习路径及职业前景分析请解锁查看)'
      }
    }

    return {
      fullContent: result.fullContent || '生成失败',
      summary: result.summary || '生成失败'
    }

  } catch (err) {
    console.error('AI 调用失败:', err)
    // 如果 AI 调用失败，为了不让用户卡住，可以返回一个模拟的错误提示或降级数据
    // 这里选择抛出错误，让前端感知
    throw new Error('AI 服务暂时不可用: ' + err.message)
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { targetCareer, score, personalInfo } = event

  try {
    // 1. 调用 AI
    const aiResult = await callAI(targetCareer, score, personalInfo)

    // 2. 存入数据库
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

    const res = await db.collection('records').add({
      data: record
    })

    // 3. 返回结果 (只返回摘要和ID)
    return {
      success: true,
      recordId: res._id,
      summary: aiResult.summary,
      price: record.price,
      originalPrice: record.originalPrice
    }

  } catch (err) {
    console.error(err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}