const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const {
    targetCareer,
    province,
    totalScore,
    rank,
    scoreLevel,
    selectedSubjects,
    mbti,
    interest,
    careerPlan,
    personalInfo,
    scoreDetail,
    fullContent,
    summary,
    structuredReport,
    rawAiContent,
    partialEndIndex = 360
  } = event

  try {
    if (!fullContent || !summary || !structuredReport) {
      return {
        success: false,
        errMsg: '缺少AI完整报告或结构化报告数据'
      }
    }

    const record = {
      _openid: wxContext.OPENID,
      targetCareer: targetCareer || '职业与志愿分析',
      province: province || '',
      totalScore: totalScore || '',
      rank: rank || '',
      scoreLevel: scoreLevel || '',
      selectedSubjects: Array.isArray(selectedSubjects) ? selectedSubjects : [],
      mbti: mbti || '',
      interest: interest || '',
      careerPlan: careerPlan || '',
      personalInfo: personalInfo || '',
      scoreDetail: scoreDetail || '',
      fullContent,
      summary,
      structuredReport: structuredReport || null,
      rawAiContent: rawAiContent || '',
      partialEndIndex,
      isPaid: false,
      price: 5.99,
      originalPrice: 19.9,
      createTime: db.serverDate()
    }

    const addRes = await db.collection('records').add({ data: record })
    return { success: true, recordId: addRes._id }
  } catch (err) {
    console.error(err)
    return { success: false, errMsg: err.message }
  }
}
