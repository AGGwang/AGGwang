const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

function toDateValue(value) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isNaN(time) ? 0 : time
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
  const keyword = String(event.keyword || '').trim()

  let whereQuery = { _openid: openid }
  if (keyword) {
    const regexp = db.RegExp({ regexp: keyword, options: 'i' })
    whereQuery = _.and([
      { _openid: openid },
      _.or([
        { targetCareer: regexp },
        { province: regexp },
        { scoreLevel: regexp },
        { mbti: regexp },
        { interest: regexp },
        { careerPlan: regexp },
        { scoreDetail: regexp }
      ])
    ])
  }

  let careerList = []
  try {
    const careerRes = await db.collection('records')
      .where(whereQuery)
      .orderBy('createTime', 'desc')
      .limit(200)
      .get()

    careerList = (careerRes.data || []).map((item) => ({
      _id: `career_${item._id}`,
      sourceId: item._id,
      recordType: 'career_plan',
      functionId: 'career_plan',
      featureName: '职业与志愿分析',
      title: item.targetCareer || '职业与志愿分析',
      isPaid: !!item.isPaid,
      statusText: item.isPaid ? '已解锁' : '未解锁',
      orderNo: '',
      time: item.createTime,
      timeMs: toDateValue(item.createTime)
    }))
  } catch (err) {
    careerList = []
  }

  const merged = careerList.sort((a, b) => b.timeMs - a.timeMs)
  const total = merged.length
  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageList = merged.slice(start, end).map((item) => {
    const copy = { ...item }
    delete copy.timeMs
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
