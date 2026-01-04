/**
 * 确保用户已登录，未登录则通过云函数初始化用户并缓存 openid
 * 适配腾讯云官方 wx-user-v2 模板: cloudbase_module -> wx_user_get_open_id
 * @returns {Promise<string>} openid
 */
async function ensureLogin() {
  const cached = wx.getStorageSync('openid')
  if (cached) return cached

  try {
    // 优先尝试 wx-user-v2 标准接入方式
    // 参考: cloudbase_module 调用 wx_user_get_open_id
    let openid = ''
    try {
      const res = await wx.cloud.callFunction({
        name: 'cloudbase_module',
        data: {
          name: 'wx_user_get_open_id'
        }
      })
      if (res.result && res.result.openId) {
        openid = res.result.openId
        console.log('wx-user-v2 登录成功:', openid)
      }
    } catch (e) {
      console.warn('cloudbase_module 登录失败，尝试回退本地函数', e)
    }

    // 如果模板调用失败，回退到本地 user_manage
    if (!openid) {
      const res = await wx.cloud.callFunction({
        name: 'user_manage',
        data: { type: 'login' }
      })
      const r = res.result
      openid = (r && r.userInfo && r.userInfo._openid) || (r && r.openid) || ''
    }

    if (!openid) throw new Error('无法获取 openid')

    wx.setStorageSync('openid', openid)
    return openid

  } catch (err) {
    wx.showToast({ title: '登录失败，请重试', icon: 'none' })
    throw err
  }
}

module.exports = {
  ensureLogin,
}
