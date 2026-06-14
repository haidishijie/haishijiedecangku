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
  },

  loadData: function() {
    var stats = app.getStats()
    var recentGames = app.getRecentGames(5).map(function(game) {
      var currentUser = app.globalData.currentUser
      var myScore = null
      if (game.finalScores && currentUser) {
        for (var i = 0; i < game.finalScores.length; i++) {
          if (game.finalScores[i].playerId === currentUser.id) {
            myScore = game.finalScores[i]
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

  // ========== 开局 ==========

  onStartGame: function() {
    this._checkAndStart(false)
  },

  onStartGameUnlimited: function() {
    this._checkAndStart(true)
  },

  _checkAndStart: function(unlimited) {
    try {
      var game = app.getUnfinishedGame()
      if (!game || !game.players) {
        // 没有未完成牌局 → 直接开新局
        var url = unlimited ? '/pages/new-game/new-game?unlimited=1' : '/pages/new-game/new-game'
        wx.navigateTo({ url: url })
        return
      }

      // 有未完成牌局 → 弹窗让用户选择
      var playerNames = ''
      for (var i = 0; i < game.players.length; i++) {
        if (i > 0) playerNames += '、'
        playerNames += game.players[i].name
      }
      var confirmedRounds = game.rounds ? game.rounds.length : 0
      var lastTimeStr = game.lastActivity ? app.formatActivityTime(game.lastActivity) : ''

      var content = playerNames + '\n已确认 ' + confirmedRounds + ' 轮'
      if (lastTimeStr) content += '\n最后于 ' + lastTimeStr
      content += '\n\n是否继续上一局？'

      var self = this
      wx.showModal({
        title: '有未完成的牌局',
        content: content,
        confirmText: '继续牌局',
        cancelText: '结束并开新局',
        success: function(res) {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/game/game?gameId=' + game.id })
          } else {
            app.endUnfinishedGame(game)
          }
        }
      })
    } catch (e) {
      console.error('_checkAndStart error:', e)
      // 出错时直接开新局
      var url = unlimited ? '/pages/new-game/new-game?unlimited=1' : '/pages/new-game/new-game'
      wx.navigateTo({ url: url })
    }
  },

  // ========== 导航 ==========

  onGameDetail: function(e) {
    wx.navigateTo({ url: '/pages/result/result?gameId=' + e.currentTarget.dataset.id })
  },

  onGoFriends: function() {
    wx.navigateTo({ url: '/pages/friends/friends' })
  },

  onGoHistory: function() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  onGoProfile: function() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  onGoWheel: function() {
    wx.navigateTo({ url: '/pages/wheel/wheel' })
  }
})
