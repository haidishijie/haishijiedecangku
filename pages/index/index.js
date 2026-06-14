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

    // 检测未完成的牌局（切换 tab 时触发，作为 app.onLaunch 的兜底）
    this.checkUnfinishedGame()
  },

  loadData() {
    // 加载统计数据
    const stats = app.getStats()

    // 加载最近战绩
    const recentGames = app.getRecentGames(5).map(game => {
      const myScore = game.finalScores && game.finalScores.find(s => s.playerId === (app.globalData.currentUser && app.globalData.currentUser.id))
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
    // ★ 先检查是否有未完成的牌局
    if (this._checkAndResumeUnfinished()) return
    wx.navigateTo({
      url: '/pages/new-game/new-game'
    })
  },

  // 快速开局（无人数上限）
  onStartGameUnlimited() {
    // ★ 先检查是否有未完成的牌局
    if (this._checkAndResumeUnfinished()) return
    wx.navigateTo({
      url: '/pages/new-game/new-game?unlimited=1'
    })
  },

  // 检查并恢复未完成牌局，返回 true 表示拦截了（用户选择继续牌局）
  _checkAndResumeUnfinished() {
    const game = app.globalData._unfinishedGame
    if (!game) return false

    const players = game.players.map(p => p.name).join('、')
    const confirmedRounds = game.rounds ? game.rounds.length : 0
    const hasPending = game._pendingRound && game._pendingRound.currentRoundScores &&
      game._pendingRound.currentRoundScores.length > 0
    const lastTime = game.lastActivity ? app._formatActivityTime(game.lastActivity) : ''

    let content = `${players}\n已确认 ${confirmedRounds} 轮`
    if (hasPending) {
      content += `\n（还有 ${game._pendingRound.currentRoundScores.length} 笔未确认的记分）`
    }
    if (lastTime) {
      content += `\n最后于 ${lastTime}`
    }
    content += '\n\n是否继续上一局？'

    wx.showModal({
      title: '有未完成的牌局',
      content: content,
      confirmText: '继续牌局',
      cancelText: '结束并开新局',
      success: (res) => {
        if (res.confirm) {
          // 继续上一局
          wx.navigateTo({
            url: `/pages/game/game?gameId=${game.id}`
          })
        } else {
          // 结束上一局，然后开新局
          app._endUnfinishedGame(game)
        }
      }
    })
    return true // 拦截本次操作
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
  },

  // ========== 未完成牌局检测 ==========

  checkUnfinishedGame() {
    // 委托给 app 统一处理
    app.promptUnfinishedGame()
  }
})
