// 新建牌局页逻辑
var app = getApp()
var util = require('../../utils/util')

Page({
  data: {
    players: [],
    inputName: '',
    canStart: false,
    unlimited: false,
    maxPlayers: 4,
    colors: ['#E24B4A', '#185FA5', '#D85A30', '#3B6D11', '#AF52DE', '#FF9500', '#5AC8FA', '#34C759'],
    quickNames: ['小明', '小红', '小李', '小胖', '大壮', 'Leo', '维尼', '阿篱']
  },

  onLoad: function(options) {
    // ★ 这里才是检查未完成牌局的正确位置
    // 用户在 index 点"快速开局"直接跳过来，我们在这拦截
    var unfinished = app.getUnfinishedGame()
    if (unfinished) {
      var self = this
      var names = ''
      var players = unfinished.players || []
      for (var i = 0; i < players.length; i++) {
        if (i > 0) names += '、'
        names += players[i].name
      }
      var rounds = unfinished.rounds ? unfinished.rounds.length : 0
      var timeStr = unfinished.lastActivity ? app.formatActivityTime(unfinished.lastActivity) : ''

      var content = names + '\n已确认 ' + rounds + ' 轮'
      if (timeStr) content += '\n最后于 ' + timeStr
      content += '\n\n要继续上一局还是开新局？'

      wx.showModal({
        title: '有未完成的牌局',
        content: content,
        confirmText: '继续牌局',
        cancelText: '开新局',
        success: function(res) {
          if (res.confirm) {
            // 继续牌局
            wx.redirectTo({ url: '/pages/game/game?gameId=' + unfinished.id })
          } else {
            // 开新局：先存档旧的，然后继续初始化
            app.endUnfinishedGame(unfinished)
            self._initPage(options)
          }
        }
      })
    } else {
      this._initPage(options)
    }
  },

  _initPage: function(options) {
    var unlimited = options.unlimited === '1'
    var maxPlayers = unlimited ? 8 : 4
    var currentUser = app.globalData.currentUser

    // 默认把自己加为第一个玩家
    var players = []
    if (currentUser && currentUser.name) {
      players.push({ id: currentUser.id, name: currentUser.name })
    }

    // 从牌友通讯录跳转过来时，预填牌友名字
    if (options.names) {
      var names = decodeURIComponent(options.names).split(',')
      for (var i = 0; i < names.length; i++) {
        var name = names[i].trim()
        if (name && !this._hasPlayer(players, name) && players.length < maxPlayers) {
          players.push({ id: util.generateId(), name: name })
        }
      }
    }

    this.setData({
      unlimited: unlimited,
      maxPlayers: maxPlayers,
      players: players,
      canStart: players.length >= 2
    })
  },

  _hasPlayer: function(players, name) {
    for (var i = 0; i < players.length; i++) {
      if (players[i].name === name) return true
    }
    return false
  },

  onInputName: function(e) {
    this.setData({ inputName: e.detail.value })
  },

  // 查找已存在的牌友ID
  findExistingPlayerId: function(name) {
    var games = app.globalData.games
    for (var i = games.length - 1; i >= 0; i--) {
      var p = games[i].players
      if (p) {
        for (var j = 0; j < p.length; j++) {
          if (p[j].name === name) return p[j].id
        }
      }
    }
    return null
  },

  onAddPlayer: function() {
    var name = this.data.inputName.trim()
    if (!name) return
    if (this.data.players.length >= this.data.maxPlayers) {
      wx.showToast({ title: '最多' + this.data.maxPlayers + '人', icon: 'none' })
      return
    }
    if (this._hasPlayer(this.data.players, name)) {
      wx.showToast({ title: '昵称重复了', icon: 'none' })
      return
    }
    var existingId = this.findExistingPlayerId(name)
    var players = this.data.players.concat([{ id: existingId || util.generateId(), name: name }])
    this.setData({ players: players, inputName: '', canStart: players.length >= 2 })
  },

  onQuickAdd: function(e) {
    var name = e.currentTarget.dataset.name
    if (this.data.players.length >= this.data.maxPlayers) {
      wx.showToast({ title: '最多' + this.data.maxPlayers + '人', icon: 'none' })
      return
    }
    if (this._hasPlayer(this.data.players, name)) {
      wx.showToast({ title: '昵称重复了', icon: 'none' })
      return
    }
    var existingId = this.findExistingPlayerId(name)
    var players = this.data.players.concat([{ id: existingId || util.generateId(), name: name }])
    this.setData({ players: players, canStart: players.length >= 2 })
  },

  onRemovePlayer: function(e) {
    var index = e.currentTarget.dataset.index
    var players = this.data.players.filter(function(_, i) { return i !== index })
    this.setData({ players: players, canStart: players.length >= 2 })
  },

  onStartGame: function() {
    if (this.data.players.length < 2) {
      wx.showToast({ title: '至少需要2人', icon: 'none' })
      return
    }

    var game = {
      id: util.generateId(),
      players: this.data.players.map(function(p) {
        return { id: p.id, name: p.name, total: 0 }
      }),
      rounds: [],
      status: 'playing',
      startTime: new Date().toISOString(),
      endTime: null,
      finalScores: null
    }

    app.globalData.games.unshift(game)
    app.saveGames()

    // 标记活跃牌局
    wx.setStorageSync('activeGameId', game.id)

    // 设置当前用户
    if (!app.globalData.currentUser || !app.globalData.currentUser.name) {
      app.globalData.currentUser = {
        id: game.players[0].id,
        name: game.players[0].name
      }
      app.saveCurrentUser()
    }

    wx.redirectTo({ url: '/pages/game/game?gameId=' + game.id })
  }
})
