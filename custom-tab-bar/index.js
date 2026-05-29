// 自定义底部导航栏逻辑
Component({
  data: {
    selected: 0
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const url = e.currentTarget.dataset.url

      // 检查是否已登录（除了排行榜，其他需要登录）
      const app = getApp()
      const currentUser = app.globalData.currentUser

      if (index !== 0 && (!currentUser || !currentUser.name)) {
        wx.showModal({
          title: '请先登录',
          content: '去个人中心设置昵称后再使用',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({
                url: '/pages/profile/profile'
              })
            }
          }
        })
        return
      }

      wx.switchTab({ url })
    }
  }
})
