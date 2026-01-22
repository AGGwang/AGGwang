// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 写入生成的报告记录
 * @param {{targetCareer:string, scoreDetail:string, personalInfo:string, fullContent:string, summary:string, partialEndIndex:number}} event
 * @returns {{success:boolean, recordId?:string, errMsg?:string}}
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { targetCareer, scoreDetail, personalInfo, collegeLevel, fullContent, summary, partialEndIndex = 240 } = event

  try {
    const record = {
      _openid: wxContext.OPENID,
      targetCareer,
      scoreDetail,
      personalInfo,
      collegeLevel: collegeLevel || '', // 保存院校层次
      fullContent,
      summary,
      partialEndIndex,
      isPaid: false,
      price: 5.99,
      originalPrice: 19.9,
      createTime: db.serverDate(),
    }

    const addRes = await db.collection('records').add({ data: record })
    return { success: true, recordId: addRes._id }
  } catch (err) {
    console.error(err)
    return { success: false, errMsg: err.message }
  }
}

