const aiService = require('../../services/ai')
const auth = require('../../services/auth')
const payment = require('../../services/payment')

const FREE_PREVIEW_LENGTH = 360

const EMPTY_REPORT = {
  coreConclusion: {
    title: '',
    summary: ''
  },
  scoreRows: [],
  careerOptions: [],
  majorGroups: [],
  jobDetails: [],
  incomeEstimates: [],
  roadmap: [],
  strategy: [],
  riskWarnings: [],
  fullReportMarkdown: ''
}

function clampScore(value) {
  const score = Number(value)
  if (Number.isNaN(score)) return 0
  return Math.max(0, Math.min(100, score))
}

function requiredArray(report, field, label) {
  if (!Array.isArray(report[field]) || report[field].length === 0) {
    throw new Error(`AI报告缺少${label}`)
  }
  return report[field]
}

function requiredText(value, label) {
  const text = String(value || '').trim()
  if (!text) {
    throw new Error(`AI报告缺少${label}`)
  }
  return text
}

function normalizeTextArray(value, label, minLength = 1) {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new Error(`AI报告缺少${label}`)
  }
  const list = value.map((item) => String(item || '').trim()).filter(Boolean)
  if (list.length < minLength) {
    throw new Error(`AI报告缺少${label}`)
  }
  return list
}

function uniq(list) {
  return Array.from(new Set((list || []).map((item) => String(item || '').trim()).filter(Boolean)))
}

function normalizeMajorGroups(report, careerOptions) {
  const source = report.majorGroups ||
    report.major_groups ||
    report.majorRecommendations ||
    report.recommendedMajors ||
    report.majorCategories ||
    report.majors

  if (Array.isArray(source) && source.length > 0) {
    const groups = source.map((group, index) => {
      if (typeof group === 'string') {
        return {
          label: index === 0 ? '优先推荐' : '可以考虑',
          items: [group]
        }
      }
      return {
        label: String(group.label || group.name || group.category || group.type || '适配专业'),
        items: uniq(group.items || group.majors || group.majorCategories || group.children || [])
      }
    }).filter((group) => group.items.length > 0)
    if (groups.length > 0) {
      return groups
    }
  }

  if (source && typeof source === 'object') {
    const groups = Object.keys(source).map((key) => ({
      label: key,
      items: uniq(Array.isArray(source[key]) ? source[key] : [source[key]])
    })).filter((group) => group.items.length > 0)
    if (groups.length > 0) {
      return groups
    }
  }

  const fromCareers = uniq(
    (careerOptions || []).reduce((all, career) => all.concat(career.majorCategories || []), [])
  )
  if (fromCareers.length > 0) {
    return [
      { label: '优先推荐', items: fromCareers.slice(0, 6) },
      { label: '可以考虑', items: fromCareers.slice(6, 12) }
    ].filter((group) => group.items.length > 0)
  }

  throw new Error('AI报告缺少适配专业大类')
}

function pickArray(report, fields, label) {
  for (const field of fields) {
    if (Array.isArray(report[field]) && report[field].length > 0) {
      return report[field]
    }
  }
  throw new Error(`AI报告缺少${label}`)
}

function parseStoredReport(value) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (err) {
      throw new Error('历史报告结构化数据解析失败')
    }
  }
  return value
}

function joinList(list) {
  return (list || []).map((item) => `- ${item}`).join('\n')
}

function buildFullReportMarkdown(report) {
  const careers = report.careerOptions.map((career) => `
### ${career.rank}. ${career.name}（${career.match}）
${career.desc}

**对应专业大类**
${joinList(career.majorCategories)}

**具体工作内容**
${joinList(career.workContent)}

**核心能力要求**
${joinList(career.requiredAbilities)}

**大学期间准备**
${joinList(career.collegePreparation)}

**职业收入估计**
- 毕业 1-3 年：${career.income.early}
- 毕业 3-5 年：${career.income.middle}
- 成熟阶段：${career.income.mature}
- 差异说明：${career.income.note}

**可行路径**
${career.path}

**谨慎点**
${career.caution}
`.trim()).join('\n\n')

  const majorGroups = report.majorGroups
    .map((group) => `- ${group.label}：${group.items.join('、')}`)
    .join('\n')

  const strategy = report.strategy
    .map((item) => `- ${item.label}：${item.text}`)
    .join('\n')

  const roadmap = report.roadmap
    .map((item) => `- ${item.stage}：${item.text}`)
    .join('\n')

  return `
# 职业选择与志愿填报参考方案

## 核心结论
${report.coreConclusion.title}

${report.coreConclusion.summary}

## 推荐职业方向
${careers}

## 适配专业大类
${majorGroups}

## 志愿填报策略
${strategy}

## 后续职业发展规划
${roadmap}

## 风险提醒与人工复核点
${joinList(report.riskWarnings)}
  `.trim()
}

Page({
  data: {
    recordId: '',
    record: {
      targetCareer: '职业与志愿分析',
      price: 5.99,
      originalPrice: 19.9
    },
    report: EMPTY_REPORT,
    primaryCareerName: '',
    isPaid: false,
    generating: false,
    loading: true,
    errorMessage: '',
    displayText: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ recordId: options.id })
      this.loadRecord(options.id)
      return
    }
    if (options.payload) {
      try {
        const payload = JSON.parse(decodeURIComponent(options.payload))
        this.startGeneration(payload)
      } catch (err) {
        this.failWithError('页面参数解析失败，请返回后重新提交。', err)
      }
      return
    }
    this.failWithError('缺少报告参数，请返回后重新提交。')
  },

  normalizeReport(rawReport) {
    const report = parseStoredReport(rawReport)
    if (!report || typeof report !== 'object') {
      throw new Error('AI未返回结构化报告数据')
    }

    const conclusion = report.coreConclusion || {}
    if (!conclusion.title || !conclusion.summary) {
      throw new Error('AI报告缺少核心结论')
    }

    const careerOptions = (() => {
      const rawCareerOptions = requiredArray(report, 'careerOptions', '推荐职业方向')
      if (rawCareerOptions.length < 3) {
        throw new Error('AI报告推荐职业方向少于3个')
      }
      return rawCareerOptions.map((item, index) => {
        const percent = clampScore(item.percent || String(item.match || '').replace('%', ''))
        return {
          rank: Number(item.rank) || index + 1,
          name: requiredText(item.name, `第${index + 1}个推荐职业名称`),
          match: String(item.match || `${percent}%`),
          percent,
          desc: requiredText(item.desc, `第${index + 1}个推荐职业理由`),
          majorCategories: normalizeTextArray(item.majorCategories || item.majors || item.relatedMajors, `第${index + 1}个推荐职业对应专业`, 1),
          workContent: normalizeTextArray(item.workContent || item.work_content || item.jobContent || item.tasks, `第${index + 1}个推荐职业工作内容`, 3),
          requiredAbilities: normalizeTextArray(item.requiredAbilities || item.abilities || item.skills, `第${index + 1}个推荐职业能力要求`, 3),
          collegePreparation: normalizeTextArray(item.collegePreparation || item.preparation || item.universityPreparation, `第${index + 1}个推荐职业大学准备`, 3),
          income: {
            early: requiredText(item.income?.early || item.income?.junior || item.income?.entry, `第${index + 1}个推荐职业毕业1-3年收入估计`),
            middle: requiredText(item.income?.middle || item.income?.mid, `第${index + 1}个推荐职业毕业3-5年收入估计`),
            mature: requiredText(item.income?.mature || item.income?.senior, `第${index + 1}个推荐职业成熟阶段收入估计`),
            note: requiredText(item.income?.note || item.income?.description, `第${index + 1}个推荐职业收入差异说明`)
          },
          path: requiredText(item.path || item.careerPath, `第${index + 1}个推荐职业可行路径`),
          caution: requiredText(item.caution || item.risk || item.warning, `第${index + 1}个推荐职业谨慎点`)
        }
      })
    })()

    const normalized = {
      coreConclusion: {
        title: String(conclusion.title),
        summary: String(conclusion.summary)
      },
      scoreRows: requiredArray(report, 'scoreRows', '评分指标').map((item) => ({
        label: String(item.label || ''),
        score: clampScore(item.score),
        reason: String(item.reason || '')
      })),
      careerOptions,
      majorGroups: normalizeMajorGroups(report, careerOptions),
      jobDetails: pickArray(report, ['jobDetails', 'job_details', 'workDetails', 'workContent'], '职业具体工作内容').map((item) => ({
        label: String(item.label || item.name || item.type || ''),
        text: String(item.text || item.content || item.desc || '')
      })),
      incomeEstimates: pickArray(report, ['incomeEstimates', 'income_estimates', 'incomeStages', 'income'], '职业收入估计').map((item) => ({
        stage: String(item.stage || item.label || item.name || ''),
        range: String(item.range || item.value || item.amount || ''),
        note: String(item.note || item.desc || item.description || '')
      })),
      roadmap: pickArray(report, ['roadmap', 'careerRoadmap', 'developmentPlan', 'futurePlan'], '后续职业发展规划').map((item) => ({
        stage: String(item.stage || item.label || item.period || ''),
        text: String(item.text || item.content || item.action || '')
      })),
      strategy: pickArray(report, ['strategy', 'applicationStrategy', 'volunteerStrategy'], '志愿填报策略').map((item) => ({
        label: String(item.label || item.name || ''),
        style: ['rush', 'stable', 'safe'].includes(item.style) ? item.style : '',
        text: String(item.text || item.content || item.desc || '')
      })),
      riskWarnings: pickArray(report, ['riskWarnings', 'risks', 'warnings', 'reviewPoints'], '风险提醒').map(String),
      fullReportMarkdown: ''
    }

    normalized.fullReportMarkdown = String(report.fullReportMarkdown || '').trim() || buildFullReportMarkdown(normalized)
    if (normalized.fullReportMarkdown.length < 80) {
      throw new Error('AI完整报告为空或内容过短')
    }
    return normalized
  },

  failWithError(message, err) {
    if (err) {
      console.error(message, err)
    } else {
      console.error(message)
    }
    this.setData({
      loading: false,
      generating: false,
      errorMessage: message,
      report: EMPTY_REPORT,
      primaryCareerName: '',
      displayText: ''
    })
    wx.showModal({
      title: '报告错误',
      content: message,
      showCancel: false
    })
    return { success: false, errMsg: message }
  },

  buildDisplayText(fullContent, isPaid) {
    if (!fullContent) return ''
    if (isPaid) return fullContent
    return fullContent.length > FREE_PREVIEW_LENGTH
      ? `${fullContent.substring(0, FREE_PREVIEW_LENGTH)}...`
      : fullContent
  },

  async loadRecord(id) {
    const db = wx.cloud.database()
    try {
      const res = await db.collection('records').doc(id).get()
      const data = res.data
      const report = this.normalizeReport(data.structuredReport)
      const fullContent = data.fullContent || report.fullReportMarkdown
      if (!fullContent) {
        throw new Error('历史记录缺少AI完整报告正文')
      }
      this.setData({
        record: {
          ...data,
          fullContent,
          price: data.price || 5.99,
          originalPrice: data.originalPrice || 19.9
        },
        report,
        primaryCareerName: report.careerOptions[0]?.name || '',
        isPaid: !!data.isPaid,
        displayText: this.buildDisplayText(fullContent, !!data.isPaid),
        loading: false,
        generating: false,
        errorMessage: ''
      })
      return { success: true }
    } catch (err) {
      return this.failWithError(err.message || '加载记录失败，请重新生成报告。', err)
    }
  },

  async startGeneration(payload) {
    try {
      await auth.ensureLogin()
    } catch (err) {
      return this.failWithError('登录状态获取失败，请重新进入小程序后再试。', err)
    }

    this.setData({
      generating: true,
      loading: false,
      errorMessage: '',
      record: {
        ...payload,
        targetCareer: '职业与志愿分析',
        price: 5.99,
        originalPrice: 19.9
      },
      report: EMPTY_REPORT,
      primaryCareerName: '',
      displayText: 'AI正在生成结构化报告，请稍候...'
    })

    let rawText = ''
    try {
      const result = await aiService.streamGenerateReport({
        ...payload,
        onText: (chunk) => {
          rawText += chunk
          this.setData({
            displayText: `AI已返回 ${rawText.length} 字，正在校验报告结构...`
          })
        }
      })

      if (!rawText && result) {
        rawText = result
      }
      if (!rawText) {
        throw new Error('AI生成内容为空')
      }

      this.setData({
        displayText: `AI已返回 ${rawText.length} 字，正在解析报告结构...`
      })

      let parsed = aiService.parseReportResponse(rawText)
      let report = null
      try {
        if (!parsed.structuredReport) {
          throw new Error(parsed.parseError || 'AI返回内容不是合法结构化报告')
        }
        report = this.normalizeReport(parsed.structuredReport)
      } catch (firstErr) {
        this.setData({
          displayText: 'AI第一次返回的结构不符合页面要求，正在自动校正为合法报告...'
        })
        const repaired = await aiService.repairReportResponse({
          rawText,
          payload,
          validationError: firstErr.message,
          onText: () => {
            this.setData({ displayText: 'AI正在校正报告结构，请稍候...' })
          }
        })
        if (!repaired.structuredReport) {
          throw new Error(repaired.parseError || 'AI结构化修复失败，请重新生成。')
        }
        parsed = {
          ...repaired,
          rawAiContent: `${rawText}\n\n--- repaired ---\n\n${repaired.rawAiContent || ''}`
        }
        report = this.normalizeReport(parsed.structuredReport)
      }

      const fullContent = report.fullReportMarkdown
      const summary = fullContent.substring(0, FREE_PREVIEW_LENGTH)

      const saveRes = await wx.cloud.callFunction({
        name: 'records_write',
        data: {
          ...payload,
          targetCareer: '职业与志愿分析',
          fullContent,
          summary,
          structuredReport: report,
          rawAiContent: parsed.rawAiContent,
          partialEndIndex: FREE_PREVIEW_LENGTH
        }
      })

      if (!saveRes?.result?.success) {
        throw new Error(saveRes?.result?.errMsg || '保存AI报告失败')
      }

      this.setData({
        recordId: saveRes.result.recordId,
        record: {
          ...payload,
          targetCareer: '职业与志愿分析',
          fullContent,
          summary,
          isPaid: false,
          price: 5.99,
          originalPrice: 19.9
        },
        report,
        primaryCareerName: report.careerOptions[0]?.name || '',
        isPaid: false,
        displayText: this.buildDisplayText(fullContent, false),
        generating: false,
        loading: false,
        errorMessage: ''
      })
      return { success: true, recordId: saveRes.result.recordId }
    } catch (err) {
      return this.failWithError(err.message || '生成失败，请重试。', err)
    }
  },

  async handlePay() {
    if (!this.data.recordId) {
      wx.showToast({ title: '记录ID不存在', icon: 'none' })
      return
    }

    try {
      const result = await payment.payAndWaitResult(this.data.recordId)
      if (result.success) {
        wx.showToast({ title: result.message || '支付成功', icon: 'success' })
        await this.loadRecord(this.data.recordId)
      } else if (result.cancelled) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else {
        wx.showModal({
          title: '支付失败',
          content: result.errMsg || '支付过程中出现问题，请重试',
          showCancel: false
        })
      }
    } catch (err) {
      console.error(err)
      wx.showModal({
        title: '支付异常',
        content: '支付过程中出现异常，请稍后重试',
        showCancel: false
      })
    }
  },

  handleContactExpert() {
    const teacherWechat = 'teacher_wechat_id'
    wx.setClipboardData({
      data: teacherWechat,
      success: () => wx.showToast({ title: '老师VX已复制', icon: 'success' })
    })
  }
})
