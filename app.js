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
      .sort((a, b) => new Date(a.endTime) - new Date(b.endTime)) // 按时间排序
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
      const myScore = game.finalScores?.find(s => s.playerId === currentUser.id)
      if (myScore) {
        totalScore += myScore.total
        if (myScore.total > 0) {
          wins++
          currentStreak++
          maxWinStreak = Math.max(maxWinStreak, currentStreak)
        } else {
          // 平局或输都重置连胜
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
      const score = game.finalScores?.find(s => s.playerId === playerId)
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
    currentUser: null  // 当前用户信息
  }
})
