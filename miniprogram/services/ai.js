/**
 * AI服务模块 - 使用云开发 AI+ Agent 能力
 * 
 * 通过 wx.cloud.extend.AI.bot.sendMessage 调用已注册的 Agent
 * 固定使用 botId: agent-7in3main-4g77ewc940ed62a2
 * 
 * 参考文档: https://docs.cloudbase.net/ai/agent/wxExtendAiBot
 */

// AI 配置
const AI_CONFIG = {
  // Agent 配置
  botId: 'agent-7in3main-4g77ewc940ed62a2'
}

/**
 * 生成唯一ID
 */
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 生成 UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 使用 Agent 进行流式文本生成
 * @param {Object} params
 * @param {string} params.targetCareer 目标职业
 * @param {string} params.scoreDetail 各科分数详情字符串
 * @param {string} params.personalInfo 个人情况简介
 * @param {string} [params.collegeLevel] 目标院校层次
 * @param {(chunk:string)=>void} params.onText 接收增量文本的回调
 * @returns {Promise<string>} 生成的完整文本
 */
async function streamGenerateReport({ targetCareer, scoreDetail, personalInfo, collegeLevel, onText }) {
  // 构建用户输入信息
  const userMessage = `
【学生信息】
- 目标职业：${targetCareer}
- 目标院校层次：${collegeLevel || '未指定'}
- 各科分数情况：${scoreDetail}
- 个人情况：${personalInfo}

请根据以上信息，为该学生提供详细的高考"7选3"科目选择分析报告。
  `.trim()

  console.log('[AI] 调用Agent生成报告', { botId: AI_CONFIG.botId })

  try {
    // 使用 Agent 发送消息
    const res = await wx.cloud.extend.AI.bot.sendMessage({
      data: {
        botId: AI_CONFIG.botId,
        threadId: generateUUID(),
        runId: generateId('run'),
        messages: [
          { id: generateId('msg'), role: 'user', content: userMessage }
        ],
        tools: [],
        context: [],
        state: {},
        forwardedProps: {}
      }
    })

    // 收集完整文本
    let fullText = ''
    let isFinished = false

    // 使用 try-catch 包装流式读取，确保异常时也能返回
    try {
      for await (let event of res.eventStream) {
        // 检查是否已完成
        if (isFinished) {
          break
        }

        // 解析事件数据
        let data
        try {
          data = JSON.parse(event.data)
        } catch (parseErr) {
          console.log('[AI] 事件数据解析跳过:', event.data)
          continue
        }

        switch (data.type) {
          case 'TEXT_MESSAGE_CONTENT':
            const delta = data.delta || ''
            if (delta) {
              fullText += delta
              if (typeof onText === 'function') {
                onText(delta)
              }
            }
            break

          case 'RUN_ERROR':
            console.error('[AI] 运行出错:', data.message)
            isFinished = true
            break

          case 'RUN_FINISHED':
            console.log('[AI] 收到完成信号 RUN_FINISHED')
            isFinished = true
            break

          case 'TEXT_MESSAGE_END':
            console.log('[AI] 收到消息结束信号 TEXT_MESSAGE_END')
            // 不立即结束，等待 RUN_FINISHED
            break

          default:
            // 其他事件类型，记录日志
            console.log('[AI] 收到事件:', data.type)
        }
      }
    } catch (streamErr) {
      console.warn('[AI] 流式读取异常（可能是正常结束）:', streamErr.message || streamErr)
    }

    // 返回结果
    if (fullText.length > 0) {
      console.log('[AI] Agent生成完成，内容长度:', fullText.length)
      return fullText
    }

    throw new Error('Agent生成内容为空')
  } catch (err) {
    console.error('[AI] Agent调用失败:', err)
    throw err
  }
}

/**
 * 使用 Agent 进行非流式文本生成
 * @param {Object} params
 * @param {string} params.targetCareer 目标职业
 * @param {string} params.scoreDetail 各科分数详情字符串
 * @param {string} params.personalInfo 个人情况简介
 * @param {string} [params.collegeLevel] 目标院校层次
 * @returns {Promise<string>} 生成的完整文本
 */
async function generateReport({ targetCareer, scoreDetail, personalInfo, collegeLevel }) {
  // 直接调用流式方法，但不传递 onText 回调
  return await streamGenerateReport({
    targetCareer,
    scoreDetail,
    personalInfo,
    collegeLevel,
    onText: null
  })
}

/**
 * 直接发送消息给AI（通用接口）
 * @param {string} message 用户消息
 * @param {(chunk:string)=>void} [onText] 接收增量文本的回调
 * @returns {Promise<string>} AI响应
 */
async function sendMessage(message, onText) {
  console.log('[AI] 发送消息到Agent', { botId: AI_CONFIG.botId })

  try {
    // 使用 Agent 发送消息
    const res = await wx.cloud.extend.AI.bot.sendMessage({
      data: {
        botId: AI_CONFIG.botId,
        threadId: generateUUID(),
        runId: generateId('run'),
        messages: [
          { id: generateId('msg'), role: 'user', content: message }
        ],
        tools: [],
        context: [],
        state: {},
        forwardedProps: {}
      }
    })

    // 收集完整文本
    let fullText = ''
    let isFinished = false

    try {
      for await (let event of res.eventStream) {
        if (isFinished) break

        let data
        try {
          data = JSON.parse(event.data)
        } catch {
          continue
        }

        switch (data.type) {
          case 'TEXT_MESSAGE_CONTENT':
            const delta = data.delta || ''
            if (delta) {
              fullText += delta
              if (typeof onText === 'function') {
                onText(delta)
              }
            }
            break

          case 'RUN_ERROR':
            console.error('[AI] 运行出错:', data.message)
            isFinished = true
            break

          case 'RUN_FINISHED':
            console.log('[AI] 收到完成信号')
            isFinished = true
            break
        }
      }
    } catch (streamErr) {
      console.warn('[AI] 流式读取异常:', streamErr.message || streamErr)
    }

    if (fullText.length > 0) {
      return fullText
    }

    throw new Error('Agent生成内容为空')
  } catch (err) {
    console.error('[AI] Agent调用失败:', err)
    throw err
  }
}

/**
 * 获取 Agent 列表
 * @returns {Promise<Array>} Agent 列表
 */
async function getAgentList() {
  try {
    const list = await wx.cloud.extend.AI.bot.list({
      pageNumber: 1,
      pageSize: 20
    })
    console.log('[AI] Agent列表:', list)
    return list.botList || []
  } catch (err) {
    console.error('[AI] 获取Agent列表失败:', err)
    return []
  }
}

/**
 * 使用指定 Agent 发送消息
 * @param {string} botId Agent ID
 * @param {string} message 用户消息
 * @param {(chunk:string)=>void} [onText] 接收增量文本的回调
 * @returns {Promise<string>} AI响应
 */
async function sendMessageToAgent(botId, message, onText) {
  console.log('[AI] 发送消息到指定Agent', { botId })

  try {
    const res = await wx.cloud.extend.AI.bot.sendMessage({
      data: {
        botId: botId,
        threadId: generateUUID(),
        runId: generateId('run'),
        messages: [
          { id: generateId('msg'), role: 'user', content: message }
        ],
        tools: [],
        context: [],
        state: {},
        forwardedProps: {}
      }
    })

    let fullText = ''
    let isFinished = false

    try {
      for await (let event of res.eventStream) {
        if (isFinished) break

        let data
        try {
          data = JSON.parse(event.data)
        } catch {
          continue
        }

        switch (data.type) {
          case 'TEXT_MESSAGE_CONTENT':
            const delta = data.delta || ''
            if (delta) {
              fullText += delta
              if (typeof onText === 'function') {
                onText(delta)
              }
            }
            break

          case 'RUN_ERROR':
            console.error('[AI] 运行出错:', data.message)
            isFinished = true
            break

          case 'RUN_FINISHED':
            isFinished = true
            break
        }
      }
    } catch (streamErr) {
      console.warn('[AI] 流式读取异常:', streamErr.message || streamErr)
    }

    if (fullText.length > 0) {
      return fullText
    }
    throw new Error('Agent生成内容为空')
  } catch (err) {
    console.error('[AI] Agent调用失败:', err)
    throw err
  }
}

/**
 * 获取聊天记录（暂不支持）
 * @param {number} pageNumber 页码
 * @param {number} pageSize 每页数量
 * @returns {Promise<Array>} 聊天记录列表
 */
async function getChatRecords(pageNumber = 1, pageSize = 10) {
  console.log('[AI] 当前模式暂不支持获取聊天记录')
  return []
}

module.exports = {
  streamGenerateReport,
  generateReport,
  sendMessage,
  sendMessageToAgent,
  getChatRecords,
  getAgentList,

  /**
   * 解析报告响应内容
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
   * 获取当前AI配置
   */
  getAIConfig() {
    return { ...AI_CONFIG }
  },

  /**
   * 设置 Agent ID
   * @param {string} botId 
   */
  setAgentId(botId) {
    AI_CONFIG.botId = botId
  }
}
