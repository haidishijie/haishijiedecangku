// 首页逻辑
const app = getApp()
const { formatDate } = require('../../utils/util')
const themeUtil = require('../../utils/theme')

Page({
  data: {
    stats: {
      totalGames: 0,
      wins: 0,
      maxWinStreak: 0
    },
    recentGames: [],
    themeClass: 'theme-ios23'
  },

  onShow() {
    // 设置 tab 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    // 加载主题
    const theme = themeUtil.getCurrentTheme()
    this.setData({ themeClass: theme.className })
    this.loadData()
  },

  loadData() {
    // 加载统计数据
    const stats = app.getStats()

    // 加载最近战绩
    const recentGames = app.getRecentGames(5).map(game => {
      const myScore = game.finalScores?.find(s => s.playerId === app.globalData.currentUser?.id)
      return {
        id: game.id,
        playerCount: game.players.length,
        roundCount: game.rounds.length,
        playerNames: game.players.map(p => p.name).join(' '),
        myScore: myScore ? myScore.total : 0,
        date: formatDate(game.endTime)
      }
    })

    this.setData({ stats, recentGames })
  },

  // 快速开局（默认）
  onStartGame() {
    wx.navigateTo({
      url: '/pages/new-game/new-game'
    })
  },

  // 快速开局（无人数上限）
  onStartGameUnlimited() {
    wx.navigateTo({
      url: '/pages/new-game/new-game?unlimited=1'
    })
  },

  // 查看牌局详情
  onGameDetail(e) {
    const gameId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/result/result?gameId=${gameId}`
    })
  },

  // 跳转到牌友通讯录
  onGoFriends() {
    wx.navigateTo({
      url: '/pages/friends/friends'
    })
  },

  // 跳转到历史记录
  onGoHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    })
  },

  // 跳转到个人中心
  onGoProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  },

  // 跳转到大转盘
  onGoWheel() {
    wx.navigateTo({
      url: '/pages/wheel/wheel'
    })
  }
})
