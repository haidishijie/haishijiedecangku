// 首页逻辑
var app = getApp()
var util = require('../../utils/util')
var themeUtil = require('../../utils/theme')

Page({
  data: {
    stats: { totalGames: 0, wins: 0, maxWinStreak: 0 },
    recentGames: [],
    themeClass: 'theme-ios23'
  },

  onShow: function() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    var theme = themeUtil.getCurrentTheme()
    this.setData({ themeClass: theme.className })
    this.loadData()

    // 启用分享菜单（好友 + 朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  loadData: function() {
    var stats = app.getStats()
    var recentGames = app.getRecentGames(5).map(function(game) {
      var currentUser = app.globalData.currentUser
      var myScore = null
      if (game.finalScores && currentUser) {
        var myId = currentUser.id
        var myName = currentUser.name || ''
        for (var i = 0; i < game.finalScores.length; i++) {
          var s = game.finalScores[i]
          if (s.playerId === myId || (myName && s.playerName === myName)) {
            myScore = s
            break
          }
        }
      }
      return {
        id: game.id,
        playerCount: game.players ? game.players.length : 0,
        roundCount: game.rounds ? game.rounds.length : 0,
        playerNames: game.players ? game.players.map(function(p) { return p.name }).join(' ') : '',
        myScore: myScore ? myScore.total : 0,
        date: util.formatDate(game.endTime)
      }
    })
    this.setData({ stats: stats, recentGames: recentGames })
  },

  // ========== 开局（极简：直接跳转，不检查） ==========

  onStartGame: function() {
    wx.navigateTo({ url: '/pages/new-game/new-game' })
  },

  onStartGameUnlimited: function() {
    wx.navigateTo({ url: '/pages/new-game/new-game?unlimited=1' })
  },

  // ========== 导航 ==========

  onGameDetail: function(e) {
    wx.navigateTo({ url: '/pages/result/result?gameId=' + e.currentTarget.dataset.id })
  },

  onGoWheel: function() {
    wx.navigateTo({ url: '/pages/wheel/wheel' })
  },

  onGoDice: function() {
    wx.navigateTo({ url: '/pages/dice/dice' })
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
