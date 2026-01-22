/**
 * AI服务模块 - 使用腾讯云开发Agent
 * 
 * Agent ID: ibot-7xuan3xiaoc-nhtshc
 * 提示词已在云开发平台配置好，只需传入用户信息即可
 */

// Agent配置
const AGENT_CONFIG = {
  botId: 'ibot-7xuan3xiaoc-nhtshc'
}

/**
 * 使用Agent进行流式文本生成
 * @param {Object} params
 * @param {string} params.targetCareer 目标职业
 * @param {string} params.scoreDetail 各科分数详情字符串
 * @param {string} params.personalInfo 个人情况简介
 * @param {string} [params.collegeLevel] 目标院校层次
 * @param {(chunk:string)=>void} params.onText 接收增量文本的回调
 * @returns {Promise<string>} 生成的完整文本
 */
async function streamGenerateReport({ targetCareer, scoreDetail, personalInfo, collegeLevel, onText }) {
  // 构建用户输入信息（Agent已配置好提示词，只需传入用户数据）
  const userMessage = `
【学生信息】
- 目标职业：${targetCareer}
- 目标院校层次：${collegeLevel || '未指定'}
- 各科分数情况：${scoreDetail}
- 个人情况：${personalInfo}
  `.trim()

  console.log('[AI] 调用Agent生成报告', { botId: AGENT_CONFIG.botId })

  // 调用Agent
  const res = await wx.cloud.extend.AI.bot.sendMessage({
    data: {
      botId: AGENT_CONFIG.botId,
      msg: userMessage
    }
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
      console.warn('[AI] Stream error:', err?.message || err)
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
      console.warn('[AI] Stream idle timeout, returning content')
      break
    }
  }

  if (fullText.length > 0) {
    console.log('[AI] 生成完成，内容长度:', fullText.length)
    return fullText
  }
  throw new Error('生成内容为空')
}

/**
 * 使用Agent进行非流式文本生成
 * @param {Object} params
 * @param {string} params.targetCareer 目标职业
 * @param {string} params.scoreDetail 各科分数详情字符串
 * @param {string} params.personalInfo 个人情况简介
 * @param {string} [params.collegeLevel] 目标院校层次
 * @returns {Promise<string>} 生成的完整文本
 */
async function generateReport({ targetCareer, scoreDetail, personalInfo, collegeLevel }) {
  // 构建用户输入信息
  const userMessage = `
【学生信息】
- 目标职业：${targetCareer}
- 目标院校层次：${collegeLevel || '未指定'}
- 各科分数情况：${scoreDetail}
- 个人情况：${personalInfo}
  `.trim()

  console.log('[AI] 调用Agent生成报告（非流式）', { botId: AGENT_CONFIG.botId })

  // 调用Agent
  const res = await wx.cloud.extend.AI.bot.sendMessage({
    data: {
      botId: AGENT_CONFIG.botId,
      msg: userMessage
    }
  })

  // 收集完整响应
  let fullText = ''
  for await (let str of res.textStream) {
    fullText += str
  }

  if (fullText.length > 0) {
    console.log('[AI] 生成完成，内容长度:', fullText.length)
    return fullText
  }
  throw new Error('生成内容为空')
}

/**
 * 获取Agent聊天记录
 * @param {number} pageNumber 页码
 * @param {number} pageSize 每页数量
 * @returns {Promise<Array>} 聊天记录列表
 */
async function getChatRecords(pageNumber = 1, pageSize = 10) {
  try {
    const records = await wx.cloud.extend.AI.bot.getChatRecords({
      botId: AGENT_CONFIG.botId,
      pageNumber,
      pageSize,
      sort: 'desc'
    })
    return records
  } catch (err) {
    console.error('[AI] 获取聊天记录失败:', err)
    return []
  }
}

/**
 * 获取Agent列表
 * @returns {Promise<Array>} Agent列表
 */
async function getAgentList() {
  try {
    const list = await wx.cloud.extend.AI.bot.list({
      pageNumber: 1,
      pageSize: 10
    })
    console.log('[AI] Agent列表:', list)
    return list
  } catch (err) {
    console.error('[AI] 获取Agent列表失败:', err)
    return []
  }
}

module.exports = {
  streamGenerateReport,
  generateReport,
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
   * 获取当前Agent配置
   */
  getAgentConfig() {
    return { ...AGENT_CONFIG }
  },

  /**
   * 设置Agent ID（用于切换不同Agent）
   * @param {string} botId 
   */
  setAgentId(botId) {
    AGENT_CONFIG.botId = botId
  }
}
