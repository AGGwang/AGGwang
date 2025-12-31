/**
 * 使用混元模型进行流式文本生成（官方示例接入方式）
 * 依赖：wx.cloud.extend.AI（前端环境）
 * @param {Object} params
 * @param {string} params.targetCareer 目标职业
 * @param {string} params.scoreDetail 各科分数详情字符串
 * @param {string} params.personalInfo 个人情况简介
 * @param {(chunk:string)=>void} params.onText 接收增量文本的回调
 * @param {(event:any)=>void} [params.onEvent] 接收事件流的回调（可选）
 * @returns {Promise<string>} 生成的完整文本（JSON 字符串，包含 fullContent/summary）
 */
async function streamGenerateReport({ targetCareer, scoreDetail, personalInfo, onText, onEvent }) {
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
  const res = await model.streamText({
    data: {
      model: 'hunyuan-t1-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    },
  })

  let fullText = ''
  let throttleTimer = null
  let throttledBuffer = ''

  const toString = (chunk) => {
    if (typeof chunk === 'string') return chunk
    if (chunk instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(new Uint8Array(chunk))
    if (chunk && chunk.buffer instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(new Uint8Array(chunk.buffer))
    try {
      return String(chunk)
    } catch {
      return ''
    }
  }

  try {
    for await (let event of res.eventStream) {
      let piece = ''
      if (typeof event === 'string') {
        piece = event
      } else if (event && event.choices && event.choices[0] && event.choices[0].delta && event.choices[0].delta.content) {
        piece = event.choices[0].delta.content
      } else if (event && event.data && typeof event.data.output_text === 'string') {
        piece = event.data.output_text
      } else if (event && typeof event.content === 'string') {
        piece = event.content
      }
      if (!piece) continue
      fullText += piece
      throttledBuffer += piece
      if (typeof onText === 'function') {
        if (!throttleTimer) {
          throttleTimer = setTimeout(() => {
            onText(throttledBuffer)
            throttledBuffer = ''
            throttleTimer = null
          }, 80)
        }
      }
    }
  } catch (e) {
    for await (let str of res.textStream) {
      const piece = toString(str)
      fullText += piece
      throttledBuffer += piece
      if (typeof onText === 'function') {
        if (!throttleTimer) {
          throttleTimer = setTimeout(() => {
            onText(throttledBuffer)
            throttledBuffer = ''
            throttleTimer = null
          }, 80)
        }
      }
    }
  }
  if (throttleTimer && typeof onText === 'function' && throttledBuffer) {
    onText(throttledBuffer)
    clearTimeout(throttleTimer)
  }

  if (typeof onEvent === 'function') {
    try {
      for await (let event of res.eventStream) {
        onEvent(event)
      }
    } catch { }
  }

  return fullText
}

module.exports = {
  streamGenerateReport,
  /**
   * 生成最终报告（非流式），用于写库，避免乱码
   * @param {Object} params
   * @param {string} params.targetCareer
   * @param {string} params.scoreDetail
   * @param {string} params.personalInfo
   * @returns {Promise<{fullContent:string, summary:string}>}
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
