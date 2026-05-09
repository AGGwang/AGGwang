const AI_CONFIG = {
  provider: 'hunyuan-exp',
  model: 'hunyuan-turbos-latest'
}

const STREAM_IDLE_TIMEOUT = 8000
const STREAM_TOTAL_TIMEOUT = 120000

const REPORT_PROMPT = `
# Role
你是一位高考志愿填报与职业规划咨询专家，服务对象是刚高中毕业、正在做职业选择和志愿填报参考的学生与家长。

# Goal
根据学生提供的省份、总分、位次、成绩层次、选考科目、MBTI、兴趣方向、职业路径规划和个人想法，生成一份结构清晰、稳妥、可执行的结构化 AI 报告，给前端直接渲染。

# Constraints
1. 必须只输出一个合法 JSON 对象，不要输出 Markdown 代码块，不要输出解释性前后缀。
2. 语气专业、克制、可落地，避免夸大承诺。
3. 所有建议只能作为参考，必须提醒最终填报需结合当年官方招生计划、位次表、专业组和家庭实际情况。
4. 必须结合职业路径规划，例如本科就业、考研深造、考公考编、出国留学。
5. 必须包含职业具体工作内容、职业收入估计、后续职业发展规划。
6. 不要输出空泛套话，不要只给专业名称，要解释为什么适合、有什么风险、后续怎么做。
7. 所有模块内容必须基于学生输入生成，不允许使用模板示例或虚构具体录取结论。
8. JSON 字符串中不能出现未转义换行。
9. 推荐职业方向必须至少 3 个，并且每个职业方向都要细致到可被单独阅读，不能只写一句简介。
10. 不要输出 Markdown 报告正文，不要输出 fullReportMarkdown 字段，完整报告由前端根据结构化字段排版。
11. 回复第一个字符必须是 {，最后一个字符必须是 }。
12. 所有属性名必须使用英文双引号，所有字符串必须使用英文双引号，不允许单引号。

# Output Format
请严格输出以下 JSON 结构，字段名不能更改。careerOptions 必须实际输出数组，长度必须为 3-5，每个对象都必须包含下面完整字段：

{
  "coreConclusion": {
    "title": "一句话核心建议",
    "summary": "2-3段以内，说明总体方向、主要优势和主要风险"
  },
  "scoreRows": [
    { "label": "专业适配", "score": 0, "reason": "评分理由" },
    { "label": "录取可行", "score": 0, "reason": "评分理由" },
    { "label": "就业延展", "score": 0, "reason": "评分理由" }
  ],
  "careerOptions": [
    {
      "rank": 1,
      "name": "推荐职业方向",
      "match": "匹配度，如 86%",
      "percent": 86,
      "desc": "推荐理由，必须结合输入数据",
      "majorCategories": ["对应专业大类1", "对应专业大类2"],
      "workContent": ["具体工作内容1", "具体工作内容2", "具体工作内容3"],
      "requiredAbilities": ["核心能力1", "核心能力2", "核心能力3"],
      "collegePreparation": ["大学准备事项1", "大学准备事项2", "大学准备事项3"],
      "income": {
        "early": "毕业 1-3 年收入估计",
        "middle": "毕业 3-5 年收入估计",
        "mature": "成熟阶段收入估计",
        "note": "城市、行业、平台和个人能力差异说明"
      },
      "path": "从大学专业、实习、作品或证书到第一份工作的可行路径",
      "caution": "不适合或需谨慎的点"
    }
  ],
  "majorGroups": [
    { "label": "优先推荐", "items": ["专业大类"] },
    { "label": "可以考虑", "items": ["专业大类"] },
    { "label": "谨慎选择", "items": ["专业大类"] },
    { "label": "不建议优先", "items": ["专业大类"] }
  ],
  "jobDetails": [
    { "label": "日常任务", "text": "以最推荐职业方向为主，说明具体做什么" },
    { "label": "核心能力", "text": "该职业需要的关键能力" },
    { "label": "大学积累", "text": "大学期间应积累的经历" },
    { "label": "适合原因", "text": "为什么与该学生匹配" }
  ],
  "incomeEstimates": [
    { "stage": "毕业 1-3 年", "range": "收入区间", "note": "估计依据与差异说明" },
    { "stage": "毕业 3-5 年", "range": "收入区间", "note": "估计依据与差异说明" },
    { "stage": "成熟阶段", "range": "收入区间", "note": "估计依据与差异说明" }
  ],
  "roadmap": [
    { "stage": "暑假", "text": "具体行动" },
    { "stage": "大一", "text": "具体行动" },
    { "stage": "大二", "text": "具体行动" },
    { "stage": "大三", "text": "具体行动" },
    { "stage": "毕业前", "text": "具体行动" }
  ],
  "strategy": [
    { "label": "冲", "style": "rush", "text": "冲刺策略" },
    { "label": "稳", "style": "stable", "text": "稳妥策略" },
    { "label": "保", "style": "safe", "text": "保底策略" }
  ],
  "riskWarnings": [
    "必须人工复核的风险点"
  ]
}
`.trim()

const JSON_REPAIR_PROMPT = `
你是一名严格的 JSON 修复器与高考职业规划结构化报告编辑。

任务：
1. 你会收到学生信息和上一次模型输出。
2. 如果上一次输出是 Markdown 或非法 JSON，请把其中内容整理为合法 JSON。
3. 如果上一次输出缺少字段，请根据学生信息补全为结构化 AI 报告。

硬性要求：
1. 只输出一个合法 JSON 对象。
2. 不要输出 Markdown 代码块，不要输出解释，不要输出前后缀。
3. careerOptions 必须是数组，长度 3-5。
4. 每个 careerOptions 对象必须包含 rank、name、match、percent、desc、majorCategories、workContent、requiredAbilities、collegePreparation、income、path、caution。
5. income 必须包含 early、middle、mature、note。
6. 不要输出 fullReportMarkdown 字段。
7. 所有内容必须基于学生信息与上一次输出，不要写占位符。
`.trim()

function extractGenerateTextContent(res) {
  if (!res) return ''
  if (typeof res === 'string') return res
  return res.text ||
    res.content ||
    res?.choices?.[0]?.message?.content ||
    res?.choices?.[0]?.delta?.content ||
    ''
}

async function generateTextByModel(messages, modelName) {
  const model = wx.cloud.extend.AI.createModel(AI_CONFIG.provider)
  try {
    const res = await model.generateText({
      model: modelName,
      messages,
      temperature: 0.2,
      top_p: 0.8
    })
    return extractGenerateTextContent(res)
  } catch (directErr) {
    console.warn('generateText 直接参数调用失败，尝试 data 包装参数', directErr)
    const res = await model.generateText({
      data: {
        model: modelName,
        messages,
        temperature: 0.2,
        top_p: 0.8
      }
    })
    return extractGenerateTextContent(res)
  }
}

async function streamTextByModelOnce(messages, onText, modelName) {
  const model = wx.cloud.extend.AI.createModel(AI_CONFIG.provider)
  const res = await model.streamText({
    data: {
      model: modelName,
      messages,
      temperature: 0.2,
      top_p: 0.8
    }
  })

  let fullText = ''
  if (res.textStream) {
    fullText = await readTextStreamWithTimeout(res.textStream, onText)
  }

  if (fullText) {
    return fullText
  }

  if (res.eventStream) {
    fullText = await readEventStreamWithTimeout(res.eventStream, onText)
  }

  return fullText
}

function getAsyncIterator(stream) {
  return typeof stream[Symbol.asyncIterator] === 'function'
    ? stream[Symbol.asyncIterator]()
    : stream
}

function nextWithTimeout(iterator, timeoutMs) {
  let timer = null
  return Promise.race([
    iterator.next(),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timeout: true }), timeoutMs)
    })
  ]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

async function readTextStreamWithTimeout(stream, onText) {
  const iterator = getAsyncIterator(stream)
  const startedAt = Date.now()
  let fullText = ''

  while (Date.now() - startedAt < STREAM_TOTAL_TIMEOUT) {
    const result = await nextWithTimeout(iterator, fullText ? STREAM_IDLE_TIMEOUT : STREAM_TOTAL_TIMEOUT)
    if (result.timeout) {
      if (fullText) {
        console.warn('AI文本流空闲超时，使用已返回内容继续处理')
        return fullText
      }
      return ''
    }
    if (result.done) {
      return fullText
    }
    const text = result.value
    if (text) {
      fullText += text
      if (typeof onText === 'function') {
        onText(text)
      }
    }
  }

  if (fullText) {
    console.warn('AI文本流总时长超时，使用已返回内容继续处理')
  }
  return fullText
}

async function readEventStreamWithTimeout(stream, onText) {
  const iterator = getAsyncIterator(stream)
  const startedAt = Date.now()
  let fullText = ''

  while (Date.now() - startedAt < STREAM_TOTAL_TIMEOUT) {
    const result = await nextWithTimeout(iterator, fullText ? STREAM_IDLE_TIMEOUT : STREAM_TOTAL_TIMEOUT)
    if (result.timeout) {
      if (fullText) {
        console.warn('AI事件流空闲超时，使用已返回内容继续处理')
        return fullText
      }
      return ''
    }
    if (result.done) {
      return fullText
    }
    const event = result.value || {}
    if (event.data === '[DONE]') {
      break
    }
    let data = null
    try {
      data = JSON.parse(event.data)
    } catch (err) {
      data = null
    }
    if (!data) {
      continue
    }
    const text = data?.choices?.[0]?.delta?.content
    if (text) {
      fullText += text
      if (typeof onText === 'function') {
        onText(text)
      }
    }
  }
  return fullText
}

async function streamTextByModel(messages, onText) {
  const errors = []

  try {
    const text = await streamTextByModelOnce(messages, onText, AI_CONFIG.model)
    if (text) {
      return text
    }
    errors.push(`${AI_CONFIG.model} streamText: 内容为空`)
  } catch (err) {
    console.warn(`模型 ${AI_CONFIG.model} streamText 调用失败`, err)
    errors.push(`${AI_CONFIG.model} streamText: ${err.message || '调用失败'}`)
  }

  try {
    const text = await generateTextByModel(messages, AI_CONFIG.model)
    if (text) {
      if (typeof onText === 'function') {
        onText(text)
      }
      console.warn(`模型 ${AI_CONFIG.model} streamText 未返回内容，已使用同模型 generateText 结果`)
      return text
    }
    errors.push(`${AI_CONFIG.model} generateText: 内容为空`)
  } catch (err) {
    console.warn(`模型 ${AI_CONFIG.model} generateText 调用失败`, err)
    errors.push(`${AI_CONFIG.model} generateText: ${err.message || '调用失败'}`)
  }

  throw new Error(`模型生成内容为空。已尝试：${errors.join('；')}`)
}

async function streamGenerateReport(payload) {
  return streamTextByModel(buildReportMessages(payload), payload.onText)
}

function buildStudentMessage(payload) {
  const {
    province,
    totalScore,
    rank,
    scoreLevel,
    selectedSubjects,
    mbti,
    interest,
    careerPlan,
    personalInfo,
    scoreDetail
  } = payload

  const subjects = Array.isArray(selectedSubjects) ? selectedSubjects.join(' + ') : selectedSubjects
  return `
【学生信息】
- 省份：${province || '未提供'}
- 总分：${totalScore || '未提供'}
- 全省位次：${rank || '未提供'}
- 成绩层次：${scoreLevel || '未提供'}
- 选考科目：${subjects || '未提供'}
- MBTI：${mbti || '未提供'}
- 兴趣方向：${interest || '未提供'}
- 职业路径规划：${careerPlan || '未提供'}
- 个人想法：${personalInfo || '未提供'}
- 其他分数信息：${scoreDetail || '无'}
  `.trim()
}

function buildReportMessages(payload) {
  return [
    { role: 'system', content: REPORT_PROMPT },
    { role: 'user', content: buildStudentMessage(payload) }
  ]
}

async function generateReport(payload) {
  return streamGenerateReport({
    ...payload,
    onText: null
  })
}

function extractJsonText(rawText) {
  const text = String(rawText || '').trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  let start = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) {
      continue
    }
    if (char === '{') {
      if (start === -1) {
        start = index
      }
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (start !== -1 && depth === 0) {
        return text.substring(start, index + 1)
      }
    }
  }

  const fallbackStart = text.indexOf('{')
  const fallbackEnd = text.lastIndexOf('}')
  if (fallbackStart === -1 || fallbackEnd === -1 || fallbackEnd <= fallbackStart) {
    return text
  }
  return text.substring(fallbackStart, fallbackEnd + 1)
}

function sanitizeJsonText(jsonText) {
  return String(jsonText || '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/，\s*([\]}])/g, ',$1')
    .replace(/,\s*([\]}])/g, '$1')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
}

function parseStructuredReport(rawText) {
  const jsonText = extractJsonText(rawText)
  try {
    return JSON.parse(jsonText)
  } catch (firstErr) {
    try {
      return JSON.parse(sanitizeJsonText(jsonText))
    } catch (secondErr) {
      console.warn('AI结构化报告解析失败', secondErr, jsonText.slice(0, 500))
      return null
    }
  }
}

function parseReportResponse(rawText) {
  if (!rawText) {
    return {
      fullContent: '',
      summary: '',
      structuredReport: null,
      rawAiContent: '',
      parseError: 'AI生成内容为空'
    }
  }
  const structuredReport = parseStructuredReport(rawText)
  if (!structuredReport) {
    return {
      fullContent: '',
      summary: '',
      structuredReport: null,
      rawAiContent: rawText,
      parseError: 'AI返回内容不是合法JSON'
    }
  }
  return {
    fullContent: '',
    summary: '',
    structuredReport,
    rawAiContent: rawText
  }
}

async function repairReportResponse({ rawText, payload, validationError, onText }) {
  const source = String(rawText || '').slice(0, 12000)
  const repairMessages = [
    { role: 'system', content: JSON_REPAIR_PROMPT },
    {
      role: 'user',
      content: `
${buildStudentMessage(payload || {})}

【上一次错误】
${validationError || 'AI返回内容不是合法JSON'}

【上一次模型输出】
${source}
      `.trim()
    }
  ]

  let repairText = ''
  try {
    repairText = await generateTextByModel(repairMessages, AI_CONFIG.model)
    if (repairText && typeof onText === 'function') {
      onText(repairText)
    }
  } catch (err) {
    console.warn('AI非流式修复失败，尝试流式修复', err)
    repairText = await streamTextByModel(repairMessages, onText)
  }

  const parsed = parseReportResponse(repairText)
  return {
    ...parsed,
    rawAiContent: repairText
  }
}

async function sendMessage(message, onText) {
  return streamTextByModel([{ role: 'user', content: message }], onText)
}

module.exports = {
  streamGenerateReport,
  generateReport,
  sendMessage,
  sendMessageToAgent(botId, message, onText) {
    return sendMessage(message, onText)
  },
  getChatRecords() {
    return []
  },
  getAgentList() {
    return []
  },
  parseReportResponse,
  repairReportResponse,
  getAIConfig() {
    return { ...AI_CONFIG }
  },
  setAgentId(botId) {
    console.log('当前使用模型调用，不再使用Agent配置', botId)
  }
}
