// 加入房间逻辑
const app = getApp()
const { joinRoom } = require('../../utils/room')

Page({
  data: {
    roomCode: '',
    playerName: '',
    canJoin: false,
    joining: false
  },

  onLoad(options) {
    // 支持从分享链接直接进入
    if (options.roomCode) {
      this.setData({ roomCode: options.roomCode })
    }
    // 从个人中心读取昵称（只读）
    if (app.globalData.currentUser?.name) {
      this.setData({ playerName: app.globalData.currentUser.name })
    }
    this.checkCanJoin()
  },

  onInputCode(e) {
    this.setData({ roomCode: e.detail.value })
    this.checkCanJoin()
  },

  checkCanJoin() {
    const { roomCode, playerName } = this.data
    this.setData({
      canJoin: roomCode.length === 4 && playerName.trim().length > 0
    })
  },

  async onJoinRoom() {
    if (this.data.joining) return
    if (!this.data.canJoin) return

    const { roomCode, playerName } = this.data

    if (!playerName) {
      wx.showModal({
        title: '请先设置昵称',
        content: '去个人中心设置昵称后再加入房间',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/profile/profile' })
          }
        }
      })
      return
    }

    this.setData({ joining: true })
    wx.showLoading({ title: '加入中...' })

    try {
      const result = await joinRoom(roomCode.trim(), playerName.trim())

      wx.hideLoading()

      if (result) {
        wx.showToast({ title: '加入成功 ✅', icon: 'none' })

        const mode = result.room?.mode || 'collaborative'
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/game/game?roomId=${result.roomId}&roomCode=${roomCode}&mode=${mode}`
          })
        }, 500)
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '加入失败', icon: 'none' })
    } finally {
      this.setData({ joining: false })
    }
  }
})
