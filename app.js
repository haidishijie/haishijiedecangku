// 胡乐 - 打牌记分小程序
App({
  onLaunch() {
    this._loadFromStorage()

    if (!this.globalData.currentUser) {
      var util = require('./utils/util')
      this.globalData.currentUser = {
        id: 'user_' + util.generateId(),
        name: ''
      }
      this.saveCurrentUser()
    }

    // 清理旧版残留
    this.globalData.games.forEach(function(g) { delete g._prompted })

    // 冷启动检测（只设标记）
    this._detectUnfinished()
  },

  onShow() {
    // 热启动也检测
    this._detectUnfinished()
  },

  // ========== 未完成牌局检测 ==========

  _detectUnfinished() {
    try {
      var gl = this.globalData
      var activeGameId = wx.getStorageSync('activeGameId')
      var gameList = gl.games || []

      if (activeGameId) {
        for (var i = 0; i < gameList.length; i++) {
          if (gameList[i].id === activeGameId && gameList[i].status === 'playing') {
            gl._unfinishedGame = gameList[i]
            return
          }
        }
        wx.removeStorageSync('activeGameId')
      }

      // 降级：搜索所有 playing 的牌局
      for (var j = 0; j < gameList.length; j++) {
        if (gameList[j].status === 'playing') {
          gl._unfinishedGame = gameList[j]
          wx.setStorageSync('activeGameId', gameList[j].id)
          return
        }
      }
      gl._unfinishedGame = null
    } catch (e) {
      console.error('_detectUnfinished error:', e)
      this.globalData._unfinishedGame = null
    }
  },

  // 获取未完成牌局（只查，不弹窗，不写 storage）
  getUnfinishedGame: function() {
    this._detectUnfinished()
    return this.globalData._unfinishedGame || null
  },

  // 结束未完成牌局
  endUnfinishedGame: function(game) {
    if (!game || !game.players) return

    try {
      var finalScores = []
      for (var i = 0; i < game.players.length; i++) {
        var p = game.players[i]
        var total = 0
        if (game.rounds) {
          for (var j = 0; j < game.rounds.length; j++) {
            var round = game.rounds[j]
            if (round && round.scores) {
              for (var k = 0; k < round.scores.length; k++) {
                if (round.scores[k].playerId === p.id) {
                  total += round.scores[k].score
                }
              }
            }
          }
        }
        finalScores.push({ playerId: p.id, playerName: p.name, total: total })
      }

      game.status = 'ended'
      game.endTime = new Date().toISOString()
      game.finalScores = finalScores
      delete game._pendingRound
      delete game._prompted

      if (this.globalData._unfinishedGame === game) {
        this.globalData._unfinishedGame = null
      }
      wx.removeStorageSync('activeGameId')
      this.saveGames()
    } catch (e) {
      console.error('endUnfinishedGame error:', e)
    }
  },

  // ========== 时间格式化 ==========

  formatActivityTime: function(isoStr) {
    try {
      var d = new Date(isoStr)
      var m = d.getMonth() + 1
      var day = d.getDate()
      var h = ('0' + d.getHours()).slice(-2)
      var min = ('0' + d.getMinutes()).slice(-2)
      return m + '月' + day + '日 ' + h + ':' + min
    } catch (e) {
      return ''
    }
  },

  // ========== 存储 ==========

  _loadFromStorage: function() {
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
    // 确保是数组
    if (!Array.isArray(this.globalData.games)) this.globalData.games = []
    if (!Array.isArray(this.globalData.players)) this.globalData.players = []
  },

  saveGames: function() {
    try {
      wx.setStorageSync('games', this.globalData.games)
    } catch (err) {
      console.error('保存games失败:', err)
    }
  },

  savePlayers: function() {
    try {
      wx.setStorageSync('players', this.globalData.players)
    } catch (err) {
      console.error('保存players失败:', err)
    }
  },

  saveCurrentUser: function() {
    try {
      wx.setStorageSync('currentUser', this.globalData.currentUser)
    } catch (err) {
      console.error('保存currentUser失败:', err)
    }
  },

  // ========== 统计 ==========

  getStats: function() {
    var games = this.globalData.games
    if (!Array.isArray(games)) return { totalGames: 0, wins: 0, maxWinStreak: 0, totalScore: 0 }

    var endedGames = []
    for (var i = 0; i < games.length; i++) {
      if (games[i].status === 'ended') endedGames.push(games[i])
    }
    endedGames.sort(function(a, b) { return new Date(a.endTime) - new Date(b.endTime) })

    var currentUser = this.globalData.currentUser
    if (!currentUser || endedGames.length === 0) {
      return { totalGames: 0, wins: 0, maxWinStreak: 0, totalScore: 0 }
    }

    var totalGames = endedGames.length
    var wins = 0
    var currentStreak = 0
    var maxWinStreak = 0
    var totalScore = 0

    for (var i = 0; i < endedGames.length; i++) {
      var game = endedGames[i]
      var myScore = null
      if (game.finalScores) {
        for (var j = 0; j < game.finalScores.length; j++) {
          if (game.finalScores[j].playerId === currentUser.id) {
            myScore = game.finalScores[j]
            break
          }
        }
      }
      if (myScore) {
        totalScore += myScore.total
        if (myScore.total > 0) {
          wins++
          currentStreak++
          if (currentStreak > maxWinStreak) maxWinStreak = currentStreak
        } else {
          currentStreak = 0
        }
      }
    }

    return { totalGames: totalGames, wins: wins, maxWinStreak: maxWinStreak, totalScore: totalScore }
  },

  getRecentGames: function(limit) {
    limit = limit || 5
    var games = this.globalData.games
    if (!Array.isArray(games)) return []

    var ended = []
    for (var i = 0; i < games.length; i++) {
      if (games[i].status === 'ended') ended.push(games[i])
    }
    ended.sort(function(a, b) { return new Date(b.endTime) - new Date(a.endTime) })
    return ended.slice(0, limit)
  },

  getAllGames: function() {
    var games = this.globalData.games
    if (!Array.isArray(games)) return []

    var ended = []
    for (var i = 0; i < games.length; i++) {
      if (games[i].status === 'ended') ended.push(games[i])
    }
    ended.sort(function(a, b) { return new Date(b.endTime) - new Date(a.endTime) })
    return ended
  },

  getPlayerStats: function(playerId) {
    var games = this.globalData.games
    if (!Array.isArray(games)) return { totalGames: 0, wins: 0, totalScore: 0 }

    var totalGames = 0, wins = 0, totalScore = 0
    for (var i = 0; i < games.length; i++) {
      var game = games[i]
      if (game.status !== 'ended' || !game.finalScores) continue
      for (var j = 0; j < game.finalScores.length; j++) {
        if (game.finalScores[j].playerId === playerId) {
          totalGames++
          var score = game.finalScores[j].total
          totalScore += score
          if (score > 0) wins++
          break
        }
      }
    }
    return { totalGames: totalGames, wins: wins, totalScore: totalScore }
  },

  addPlayer: function(name) {
    var util = require('./utils/util')
    for (var i = 0; i < this.globalData.players.length; i++) {
      if (this.globalData.players[i].name === name) return null
    }
    var player = { id: util.generateId(), name: name, createdAt: new Date().toISOString() }
    this.globalData.players.push(player)
    this.savePlayers()
    return player
  },

  removePlayer: function(playerId) {
    var newPlayers = []
    for (var i = 0; i < this.globalData.players.length; i++) {
      if (this.globalData.players[i].id !== playerId) {
        newPlayers.push(this.globalData.players[i])
      }
    }
    this.globalData.players = newPlayers
    this.savePlayers()
  },

  getPlayers: function() {
    return this.globalData.players || []
  },

  globalData: {
    games: [],
    players: [],
    currentUser: null,
    _unfinishedGame: null
  }
})
