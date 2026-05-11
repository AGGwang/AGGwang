const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const GENERIC_TITLES = new Set([
  '职业与志愿分析',
  '职业选择与志愿填报参考方案',
  'AI完整报告',
  'AI 完整报告'
])

function toDateValue(value) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
}

function compactText(value, maxLength = 48) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function joinSubjects(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' + ')
  }
  return String(value || '').trim()
}

function cleanReportLine(value) {
  return String(value || '')
    .replace(/^#{1,6}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*[-*]\s*/g, '')
    .replace(/^核心结论[：:\s]*/g, '')
    .replace(/^推荐职业方向[：:\s]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function makeTitleFromLine(value) {
  const line = cleanReportLine(value)
  if (!line || GENERIC_TITLES.has(line)) return ''

  const priorityMatch = line.match(/优先考虑(.+?)(?:\s*学生|[。；;]|$)/)
  if (priorityMatch?.[1]) {
    return compactText(priorityMatch[1], 30)
  }

  const recommendMatch = line.match(/推荐(.+?)(?:\s*学生|[。；;]|$)/)
  if (recommendMatch?.[1]) {
    return compactText(recommendMatch[1], 30)
  }

  return compactText(line, 30)
}

function extractTitleFromReportText(value) {
  const source = String(value || '')
    .replace(/\r/g, '')
    .replace(/(#{1,6}\s*)/g, '\n$1')
  if (!source.trim()) return ''

  const coreMatch = source.match(/(?:^|\n)\s*#{0,6}\s*核心结论\s*\n?([\s\S]*?)(?=\n\s*#{1,6}\s*|$)/)
  const coreTitle = makeTitleFromLine((coreMatch?.[1] || '').split('\n').find((line) => cleanReportLine(line)))
  if (coreTitle) return coreTitle

  const careerMatch = source.match(/(?:^|\n)\s*#{0,6}\s*推荐职业方向\s*\n?([\s\S]*?)(?=\n\s*#{1,6}\s*|$)/)
  const careerTitle = makeTitleFromLine((careerMatch?.[1] || '').split('\n').find((line) => cleanReportLine(line)))
  if (careerTitle) return careerTitle

  return makeTitleFromLine(source.split('\n').find((line) => {
    const clean = cleanReportLine(line)
    return clean && !GENERIC_TITLES.has(clean)
  }))
}

function pickMeaningfulTitle(...values) {
  for (const value of values) {
    const title = makeTitleFromLine(value)
    if (title && !GENERIC_TITLES.has(title)) {
      return title
    }
  }
  return ''
}

function getPrimaryTitle(item) {
  const report = item.structuredReport || {}
  const firstCareer = Array.isArray(report.careerOptions) ? report.careerOptions[0] : null
  return pickMeaningfulTitle(
    firstCareer?.name,
    report.coreConclusion?.title,
    extractTitleFromReportText(item.summary),
    extractTitleFromReportText(item.fullContent),
    extractTitleFromReportText(item.rawAiContent),
    item.targetCareer
  ) || '职业与志愿分析'
}

function buildInputTags(item) {
  return [
    item.province,
    item.scoreLevel || item.collegeLevel,
    joinSubjects(item.selectedSubjects),
    item.mbti ? String(item.mbti).toUpperCase() : '',
    item.interest,
    item.careerPlan
  ].filter(Boolean).slice(0, 6)
}

function getReportSearchText(report) {
  if (!report) return ''
  const careerOptions = Array.isArray(report.careerOptions) ? report.careerOptions : []
  return [
    report.coreConclusion?.title,
    report.coreConclusion?.summary,
    ...careerOptions.flatMap((career) => [
      career.name,
      career.match,
      career.desc,
      ...(career.majorCategories || [])
    ])
  ].filter(Boolean).join(' ')
}

function buildSearchText(item, primaryTitle, tags) {
  return [
    primaryTitle,
    item.targetCareer,
    item.province,
    item.scoreLevel,
    item.collegeLevel,
    joinSubjects(item.selectedSubjects),
    item.mbti,
    item.interest,
    item.careerPlan,
    item.personalInfo,
    item.scoreDetail,
    item.summary,
    item.fullContent,
    getReportSearchText(item.structuredReport),
    ...(tags || [])
  ].filter(Boolean).join(' ').toLowerCase()
}

function normalizeCareerRecord(item) {
  const primaryTitle = getPrimaryTitle(item)
  const inputTags = buildInputTags(item)
  const isPaid = !!item.isPaid

  return {
    _id: `career_${item._id}`,
    sourceId: item._id,
    recordType: 'career_plan',
    functionId: 'career_plan',
    featureName: '职业与志愿分析',
    title: primaryTitle,
    targetCareer: item.targetCareer || '职业与志愿分析',
    primaryTitle,
    province: item.province || '',
    scoreLevel: item.scoreLevel || item.collegeLevel || '',
    selectedSubjectText: joinSubjects(item.selectedSubjects),
    mbti: item.mbti ? String(item.mbti).toUpperCase() : '',
    interest: item.interest || '',
    careerPlan: item.careerPlan || '',
    inputTags,
    summarySnippet: compactText(item.summary || item.structuredReport?.coreConclusion?.summary || item.fullContent, 72),
    isPaid,
    statusText: isPaid ? '已解锁' : '未解锁',
    orderNo: '',
    time: item.createTime,
    timeMs: toDateValue(item.createTime),
    searchText: buildSearchText(item, primaryTitle, inputTags)
  }
}

async function getCareerRecords(openid) {
  const res = await db.collection('records')
    .where({ _openid: openid })
    .orderBy('createTime', 'desc')
    .get()

  return {
    success: true,
    data: res.data || []
  }
}

async function getHistoryRecords(openid, event) {
  const page = Math.max(Number(event.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 10, 1), 50)
  const keyword = String(event.keyword || '').trim().toLowerCase()

  let careerList = []
  try {
    const careerRes = await db.collection('records')
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .limit(200)
      .get()

    careerList = (careerRes.data || [])
      .map(normalizeCareerRecord)
      .filter((item) => !keyword || item.searchText.includes(keyword))
  } catch (err) {
    console.error('get history records failed', err)
    careerList = []
  }

  const merged = careerList.sort((a, b) => b.timeMs - a.timeMs)
  const total = merged.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageList = merged.slice(start, end).map((item) => {
    const copy = { ...item }
    delete copy.timeMs
    delete copy.searchText
    return copy
  })

  return {
    success: true,
    data: pageList,
    page,
    pageSize,
    total,
    hasMore: end < total
  }
}

exports.main = async (event) => {
  const payload = event || {}
  const wxContext = cloud.getWXContext()
  const mode = payload.mode || 'career'

  try {
    if (mode === 'history') {
      return await getHistoryRecords(wxContext.OPENID, payload)
    }
    return await getCareerRecords(wxContext.OPENID)
  } catch (err) {
    console.error(err)
    return {
      success: false,
      errMsg: err.message
    }
  }
}
