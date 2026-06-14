// 胡乐 - 打牌记分小程序
App({
  onLaunch() {
    // 读取本地存储的数据（带异常处理）
    try {
      this.globalData.games = wx.getStorageSync('games') || []
      this.globalData.players = wx.getStorageSync('players') || []
      this.globalData.currentUser = wx.getStorageSync('currentUser') || null
    } catch (err) {
      console.error('读取本地存储失败:', err)
      this.globalData.games = []
      this.globalData.players = []
      this.globalData.currentUser = null
    }

    // 如果没有用户信息，生成一个临时 ID
    if (!this.globalData.currentUser) {
      const { generateId } = require('./utils/util')
      this.globalData.currentUser = {
        id: 'user_' + generateId(),
        name: ''
      }
      this.saveCurrentUser()
    }

    // 清理历史残留的 _prompted（旧版本 bug 写进了 storage）
    this.globalData.games.forEach(g => {
      delete g._prompted
    })

    // 冷启动检测
    this._doDetectUnfinished()
  },

  // 热启动（从后台切回前台）也要检测
  onShow() {
    // 只在未弹过的情况下检测（防止重复弹窗）
    if (!this.globalData._unfinishedPrompted) {
      this._doDetectUnfinished()
    }
  },

  // 统一的检测入口
  _doDetectUnfinished() {
    const activeGameId = wx.getStorageSync('activeGameId')
    if (activeGameId) {
      const game = this.globalData.games.find(g => g.id === activeGameId && g.status === 'playing')
      if (game) {
        this.globalData._unfinishedGame = game
        return
      }
      // activeGameId 对应的牌局已结束 → 清理
      wx.removeStorageSync('activeGameId')
    }

    // 降级：搜索所有 status=playing 的牌局
    const game = this.globalData.games.find(g => g.status === 'playing')
    if (game) {
      this.globalData._unfinishedGame = game
      wx.setStorageSync('activeGameId', game.id)
    }
  },

  // 弹窗提示用户继续未完成牌局（由各 tabBar 页面在 onShow 中调用）
  promptUnfinishedGame() {
    const game = this.globalData._unfinishedGame
    if (!game) return

    // 防止同一 session 重复弹窗（用 globalData 级变量，不写入 storage）
    if (this.globalData._unfinishedPrompted) return
    this.globalData._unfinishedPrompted = true

    this._showResumeModal(game)
  },

  // 统一的弹窗逻辑（多处复用）
  _showResumeModal(game) {
    const players = game.players.map(p => p.name).join('、')
    const confirmedRounds = game.rounds ? game.rounds.length : 0
    const hasPending = game._pendingRound && game._pendingRound.currentRoundScores &&
      game._pendingRound.currentRoundScores.length > 0
    const lastTime = game.lastActivity ? this._formatActivityTime(game.lastActivity) : ''

    let content = `${players}\n已确认 ${confirmedRounds} 轮`
    if (hasPending) {
      content += `\n（还有 ${game._pendingRound.currentRoundScores.length} 笔未确认的记分）`
    }
    if (lastTime) {
      content += `\n最后于 ${lastTime}`
    }
    content += '\n\n是否继续？'

    wx.showModal({
      title: '有未完成的牌局',
      content: content,
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

  // 格式化活动时间
  _formatActivityTime(isoStr) {
    try {
      const d = new Date(isoStr)
      const month = d.getMonth() + 1
      const day = d.getDate()
      const hour = d.getHours().toString().padStart(2, '0')
      const minute = d.getMinutes().toString().padStart(2, '0')
      return `${month}月${day}日 ${hour}:${minute}`
    } catch (e) {
      return ''
    }
  },

  // 结束未完成牌局（用户选择"结束并存档"）
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
    if (this.globalData._unfinishedGame === game) {
      this.globalData._unfinishedGame = null
    }
    wx.removeStorageSync('activeGameId')
    this.saveGames()

    wx.showToast({ title: '已存档', icon: 'none' })
  },

  // 保存数据到本地存储（带异常处理）
  saveGames() {
    try {
      wx.setStorageSync('games', this.globalData.games)
    } catch (err) {
      console.error('保存games失败:', err)
    }
  },

  savePlayers() {
    try {
      wx.setStorageSync('players', this.globalData.players)
    } catch (err) {
      console.error('保存players失败:', err)
    }
  },

  saveCurrentUser() {
    try {
      wx.setStorageSync('currentUser', this.globalData.currentUser)
    } catch (err) {
      console.error('保存currentUser失败:', err)
    }
  },

  // 获取历史战绩统计
  getStats() {
    const games = this.globalData.games
      .filter(g => g.status === 'ended')
      .sort((a, b) => new Date(a.endTime) - new Date(b.endTime))
    const currentUser = this.globalData.currentUser

    if (!currentUser || games.length === 0) {
      return { totalGames: 0, wins: 0, maxWinStreak: 0, totalScore: 0 }
    }

    let totalGames = games.length
    let wins = 0
    let currentStreak = 0
    let maxWinStreak = 0
    let totalScore = 0

    games.forEach(game => {
      const myScore = game.finalScores && game.finalScores.find(s => s.playerId === currentUser.id)
      if (myScore) {
        totalScore += myScore.total
        if (myScore.total > 0) {
          wins++
          currentStreak++
          maxWinStreak = Math.max(maxWinStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }
    })

    return { totalGames, wins, maxWinStreak, totalScore }
  },

  // 获取最近的牌局
  getRecentGames(limit = 5) {
    return this.globalData.games
      .filter(g => g.status === 'ended')
      .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
      .slice(0, limit)
  },

  // 获取所有已结束的牌局（按时间排序）
  getAllGames() {
    return this.globalData.games
      .filter(g => g.status === 'ended')
      .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
  },

  // 获取牌友战绩统计
  getPlayerStats(playerId) {
    const games = this.globalData.games.filter(g => g.status === 'ended')
    let totalGames = 0
    let wins = 0
    let totalScore = 0

    games.forEach(game => {
      const score = game.finalScores && game.finalScores.find(s => s.playerId === playerId)
      if (score) {
        totalGames++
        totalScore += score.total
        if (score.total > 0) wins++
      }
    })

    return { totalGames, wins, totalScore }
  },

  // 添加牌友
  addPlayer(name) {
    const { generateId } = require('./utils/util')
    const exists = this.globalData.players.some(p => p.name === name)
    if (exists) return null

    const player = {
      id: generateId(),
      name: name,
      createdAt: new Date().toISOString()
    }
    this.globalData.players.push(player)
    this.savePlayers()
    return player
  },

  // 删除牌友
  removePlayer(playerId) {
    this.globalData.players = this.globalData.players.filter(p => p.id !== playerId)
    this.savePlayers()
  },

  // 获取牌友列表
  getPlayers() {
    return this.globalData.players
  },

  globalData: {
    games: [],         // 本地牌局记录
    players: [],       // 牌友列表
    currentUser: null, // 当前用户信息
    _unfinishedGame: null,       // 未完成牌局（内存中，不写入 storage）
    _unfinishedPrompted: false    // 本 session 是否已弹过提示（内存中）
  }
})
