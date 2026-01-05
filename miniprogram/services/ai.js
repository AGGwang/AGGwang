/**
 * 使用混元模型进行流式文本生成
 * @param {Object} params
 * @param {string} params.targetCareer 目标职业
 * @param {string} params.scoreDetail 各科分数详情字符串
 * @param {string} params.personalInfo 个人情况简介
 * @param {string} [params.collegeLevel] 目标院校层次
 * @param {(chunk:string)=>void} params.onText 接收增量文本的回调
 * @returns {Promise<string>} 生成的完整文本
 */
async function streamGenerateReport({ targetCareer, scoreDetail, personalInfo, collegeLevel, onText }) {
  const prompt = `
你是一位资深的高考志愿填报与职业规划专家。
请根据以下学生信息生成一份详细的职业规划报告。

【学生信息】
- 目标职业：${targetCareer}
- 目标院校层次：${collegeLevel || '未指定'}
- 各科分数情况：${scoreDetail}
- 个人情况：${personalInfo}

【输出要求】
请直接输出 Markdown 格式报告，包含：现状分析、选科推荐、详细学习路径、未来职业前景。
  `

  const model = wx.cloud.extend.AI.createModel('hunyuan-exp')
  const res = await model.streamText({
    data: {
      model: 'hunyuan-t1-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    },
  })

  let fullText = ''
  let lastChunkTime = Date.now()
  let streamEnded = false

  // 流式读取
  const readStream = async () => {
    try {
      for await (let str of res.textStream) {
        lastChunkTime = Date.now()
        fullText += str
        if (typeof onText === 'function') {
          onText(str)
        }
      }
      streamEnded = true
    } catch (err) {
      console.warn('Stream error:', err?.message || err)
      streamEnded = true
    }
  }

  // 启动流读取（不等待）
  readStream()

  // 轮询检查：流结束或超时（10秒无新数据）
  const checkInterval = 500
  const idleTimeout = 10000
  const maxWait = 120000
  const startTime = Date.now()

  while (!streamEnded && Date.now() - startTime < maxWait) {
    await new Promise(r => setTimeout(r, checkInterval))
    // 如果超过10秒没有新数据且已有内容，认为结束
    if (fullText.length > 0 && Date.now() - lastChunkTime > idleTimeout) {
      console.warn('Stream idle timeout, returning content')
      break
    }
  }

  if (fullText.length > 0) {
    return fullText
  }
  throw new Error('生成内容为空')
}

module.exports = {
  streamGenerateReport,

  /**
   * 解析报告响应内容（用于处理 streamGenerateReport 返回的 fullText）
   * @param {string} rawText 
   * @returns {{fullContent:string, summary:string}}
   */
  parseReportResponse(rawText) {
    if (!rawText) return { fullContent: '', summary: '' }

    const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
    try {
      const parsed = JSON.parse(clean)
      return {
        fullContent: parsed.fullContent || rawText,
        summary: parsed.summary || rawText.substring(0, 240)
      }
    } catch {
      return {
        fullContent: rawText,
        summary: rawText.substring(0, 240)
      }
    }
  },

  /**
   * 生成最终报告（非流式），用于写库，避免乱码
   * @deprecated 建议直接使用 streamGenerateReport 并配合 parseReportResponse 解析，以节省 Token
   */
  async generateFinalReport({ targetCareer, scoreDetail, personalInfo }) {
    const prompt = `
你是一位资深的高考志愿填报与职业规划专家。
请根据以下学生信息生成一份详细的职业规划报告。

【学生信息】
- 目标职业：${targetCareer}
- 各科分数情况：${scoreDetail}
- 个人情况：${personalInfo}

【输出要求】
请严格按照 JSON 格式返回，不要包含 markdown 代码块标记（如 \` \` \`json），包含以下两个字段：
1. "fullContent": string 类型。一份完整的 Markdown 格式报告，包含"现状分析"（结合各科分数优劣势）、"选科推荐"（基于分数以及大学职业选科限制要求提出最优3门组合）、"详细学习路径"（分阶段）、"未来职业前景"。
2. "summary": string 类型。一份报告摘要，Markdown 格式，简要包含现状和选科推荐，并在末尾提示"(更多详细学习路径及职业前景分析请解锁查看)"。
    `
    const model = wx.cloud.extend.AI.createModel('hunyuan-exp')
    const res = await model.generateText({
      data: {
        model: 'hunyuan-t1-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      },
    })
    let content = ''
    if (typeof res === 'string') {
      content = res
    } else if (res && res.choices && res.choices[0] && res.choices[0].message) {
      content = res.choices[0].message.content || ''
    } else {
      content = JSON.stringify(res || {})
    }
    const clean = content.replace(/```json/g, '').replace(/```/g, '').trim()
    try {
      const parsed = JSON.parse(clean)
      return { fullContent: parsed.fullContent, summary: parsed.summary }
    } catch {
      return { fullContent: clean, summary: clean.substring(0, 240) }
    }
  }
}
