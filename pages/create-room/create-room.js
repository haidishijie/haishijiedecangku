// 创建房间逻辑
const app = getApp()
const { createRoom } = require('../../utils/room')

Page({
  data: {
    creating: false
  },

  async onCreateRoom(e) {
    if (this.data.creating) return

    const mode = e.currentTarget.dataset.mode
    const currentUser = app.globalData.currentUser

    if (!currentUser || !currentUser.name) {
      wx.showModal({
        title: '请先设置昵称',
        content: '去个人中心设置你的昵称后再创建房间',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/profile/profile' })
          }
        }
      })
      return
    }

    this.setData({ creating: true })
    wx.showLoading({ title: '创建中...' })

    try {
      const result = await createRoom({ mode })

      wx.hideLoading()

      if (result) {
        wx.showToast({ title: '创建成功 ✅', icon: 'none' })

        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/game/game?roomId=${result.roomId}&roomCode=${result.roomCode}&mode=${mode}`
          })
        }, 500)
      }
    } catch (err) {
      wx.hideLoading()
      console.error('创建房间失败:', err)
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      this.setData({ creating: false })
    }
  }
})
