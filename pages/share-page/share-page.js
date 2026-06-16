// 分享落地页逻辑
Page({
  data: {},

  onLoad: function() {},

  // 跳转到首页
  onGoHome: function() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 分享给朋友
  onShareAppMessage: function() {
    return {
      title: '我在用胡乐麻记分，打牌再也不怕算错账了！',
      path: '/pages/share-page/share-page'
    }
  },

  // 分享到朋友圈
  onShareTimeline: function() {
    return {
      title: '我在用胡乐麻记分，打牌再也不怕算错账了！',
      query: ''
    }
  }
})
