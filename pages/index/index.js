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

    // 检测未完成的牌局（仅在冷启动后的第一次 onShow）
    this.checkUnfinishedGame()
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
  },

  // ========== 未完成牌局检测 ==========

  checkUnfinishedGame() {
    // 读取 app 启动时检测到的未完成牌局
    const game = app.globalData._unfinishedGame
    if (!game) return

    // 防止重复弹窗
    if (game._prompted) return
    game._prompted = true

    const players = game.players.map(p => p.name).join('、')
    const lastRound = game.rounds.length
    const lastTime = game.lastActivity ? formatDate(game.lastActivity) : ''

    wx.showModal({
      title: '有未完成的牌局',
      content: `${players}\n已打 ${lastRound} 轮${lastTime ? '，最后于 ' + lastTime : ''}\n\n是否继续？`,
      confirmText: '继续牌局',
      cancelText: '结束并存档',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: `/pages/game/game?gameId=${game.id}`
          })
        } else {
          this._endUnfinishedGame(game)
        }
      }
    })
  },

  _endUnfinishedGame(game) {
    // 从已保存轮次计算最终分数
    const finalScores = game.players.map(p => {
      let total = 0
      game.rounds.forEach(round => {
        const ps = round.scores.filter(s => s.playerId === p.id)
        if (ps.length > 0) total += ps.reduce((sum, s) => sum + s.score, 0)
      })
      return { playerId: p.id, playerName: p.name, total }
    })

    game.status = 'ended'
    game.endTime = new Date().toISOString()
    game.finalScores = finalScores
    delete game._pendingRound
    delete game._prompted
    // 清除全局未完成标记
    if (app.globalData._unfinishedGame === game) {
      app.globalData._unfinishedGame = null
    }
    app.saveGames()

    wx.showToast({ title: '已存档', icon: 'none' })
    this.loadData()
  }
})
