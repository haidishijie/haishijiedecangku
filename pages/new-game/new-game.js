// 新建牌局页逻辑
const app = getApp()
const { generateId } = require('../../utils/util')

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

  onLoad(options) {
    const currentUser = app.globalData.currentUser
    const unlimited = options.unlimited === '1'
    const maxPlayers = unlimited ? 8 : 4

    // 默认把自己加为第一个玩家
    let players = []
    if (currentUser && currentUser.name) {
      players.push({
        id: currentUser.id,
        name: currentUser.name
      })
    }

    // 从牌友通讯录跳转过来时，预填牌友名字
    if (options.names) {
      const names = decodeURIComponent(options.names).split(',')
      names.forEach(name => {
        const trimmedName = name.trim()
        if (trimmedName && !players.some(p => p.name === trimmedName) && players.length < maxPlayers) {
          players.push({
            id: generateId(),
            name: trimmedName
          })
        }
      })
    }

    this.setData({
      unlimited,
      maxPlayers,
      players,
      canStart: players.length >= 2
    })
  },

  onInputName(e) {
    this.setData({ inputName: e.detail.value })
  },

  // 查找已存在的牌友ID（通过名字匹配历史记录）
  findExistingPlayerId(name) {
    const games = app.globalData.games
    for (let i = games.length - 1; i >= 0; i--) {
      const game = games[i]
      const player = game.players?.find(p => p.name === name)
      if (player) return player.id
    }
    return null
  },

  // 添加玩家
  onAddPlayer() {
    const name = this.data.inputName.trim()
    if (!name) return

    if (this.data.players.length >= this.data.maxPlayers) {
      wx.showToast({ title: `最多${this.data.maxPlayers}人`, icon: 'none' })
      return
    }

    // 检查重名
    if (this.data.players.some(p => p.name === name)) {
      wx.showToast({ title: '昵称重复了', icon: 'none' })
      return
    }

    // 优先使用历史记录中的ID，保持一致性
    const existingId = this.findExistingPlayerId(name)

    const players = [...this.data.players, {
      id: existingId || generateId(),
      name: name
    }]

    this.setData({
      players,
      inputName: '',
      canStart: players.length >= 2
    })
  },

  // 快捷添加
  onQuickAdd(e) {
    const name = e.currentTarget.dataset.name
    if (this.data.players.length >= this.data.maxPlayers) {
      wx.showToast({ title: `最多${this.data.maxPlayers}人`, icon: 'none' })
      return
    }
    if (this.data.players.some(p => p.name === name)) {
      wx.showToast({ title: '昵称重复了', icon: 'none' })
      return
    }

    // 优先使用历史记录中的ID
    const existingId = this.findExistingPlayerId(name)

    const players = [...this.data.players, {
      id: existingId || generateId(),
      name: name
    }]

    this.setData({
      players,
      canStart: players.length >= 2
    })
  },

  // 移除玩家
  onRemovePlayer(e) {
    const index = e.currentTarget.dataset.index
    const players = this.data.players.filter((_, i) => i !== index)
    this.setData({
      players,
      canStart: players.length >= 2
    })
  },

  // 开始牌局
  onStartGame() {
    if (this.data.players.length < 2) {
      wx.showToast({ title: '至少需要2人', icon: 'none' })
      return
    }

    // 创建新牌局
    const game = {
      id: generateId(),
      players: this.data.players.map(p => ({
        id: p.id,
        name: p.name
      })),
      rounds: [],
      status: 'playing',
      startTime: new Date().toISOString(),
      endTime: null,
      finalScores: null
    }

    // 保存到全局数据
    const app = getApp()
    app.globalData.games.unshift(game)
    app.saveGames()

    // 设置当前用户（第一个玩家）
    if (!app.globalData.currentUser) {
      app.globalData.currentUser = {
        id: game.players[0].id,
        name: game.players[0].name
      }
      app.saveCurrentUser()
    }

    // 跳转到记分页
    wx.redirectTo({
      url: `/pages/game/game?gameId=${game.id}`
    })
  }
})
