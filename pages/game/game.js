// 记分页逻辑（支持本地模式 + 房间模式）
const app = getApp()
const { generateId, sum } = require('../../utils/util')
const roomUtil = require('../../utils/room')

Page({
  data: {
    // 模式
    isRoomMode: false,
    roomMode: '',
    roomCode: '',
    roomId: '',

    // 本地模式
    gameId: '',

    // 通用
    players: [],
    playerNamesStr: '',
    playerColors: ['#E24B4A', '#185FA5', '#D85A30', '#3B6D11'],
    currentRound: 1,
    selectedIndex: 0,
    currentRoundScores: [],
    customScore: '',
    quickInput: '',
    voiceResult: '',
    roundHistory: [],

    // 房间模式特有
    pendingScores: [],
    isPolling: false,
    lastPollTime: ''
  },

  _pollTimer: null,

  onLoad(options) {
    if (options.roomId) {
      this.initRoomMode(options)
    } else if (options.gameId) {
      this.initLocalMode(options)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
    }
  },

  onUnload() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },

  // ========== 初始化 ==========

  initLocalMode(options) {
    const gameId = options.gameId
    const game = app.globalData.games.find(g => g.id === gameId)
    if (!game) {
      wx.showToast({ title: '牌局不存在', icon: 'none' })
      return
    }

    const players = game.players.map(p => ({
      id: p.id,
      name: p.name,
      total: 0,
      lastRound: 0
    }))

    // 获取最近4轮历史
    const roundHistory = game.rounds.slice(-4).reverse().map(round => ({
      roundNumber: round.roundNumber,
      scores: round.scores
    }))

    this.setData({
      gameId,
      isRoomMode: false,
      players,
      playerNamesStr: players.map(p => p.name).join(' '),
      currentRound: game.rounds.length + 1,
      selectedIndex: 0,
      roundHistory
    })
  },

  async initRoomMode(options) {
    const { roomId, roomCode, mode } = options

    this.setData({
      isRoomMode: true,
      roomId,
      roomCode,
      roomMode: mode || 'collaborative'
    })

    await this.loadRoomData()
    this.startPolling()
  },

  async loadRoomData() {
    const room = await roomUtil.getRoom(this.data.roomId)
    if (!room) {
      wx.showToast({ title: '房间已关闭', icon: 'none' })
      return
    }

    if (room.status === 'ended') {
      wx.redirectTo({
        url: `/pages/result/result?roomId=${this.data.roomId}`
      })
      return
    }

    const players = room.players.map(p => ({
      id: p.id,
      name: p.name,
      total: p.total || 0,
      lastRound: 0
    }))

    if (room.rounds.length > 0) {
      const lastRound = room.rounds[room.rounds.length - 1]
      players.forEach(p => {
        const score = lastRound.scores.find(s => s.playerId === p.id)
        p.lastRound = score ? score.score : 0
      })
    }

    // 获取最近4轮历史
    const roundHistory = room.rounds.slice(-4).reverse().map(round => ({
      roundNumber: round.roundNumber,
      scores: round.scores
    }))

    this.setData({
      players,
      playerNamesStr: players.map(p => p.name).join(' '),
      currentRound: room.currentRound || 1,
      pendingScores: room.pendingScores || [],
      selectedIndex: this.data.selectedIndex < 0 ? 0 : this.data.selectedIndex,
      roundHistory
    })
  },

  startPolling() {
    if (this._pollTimer) return

    this._pollTimer = setInterval(async () => {
      await this.loadRoomData()
      this.setData({ lastPollTime: new Date().toLocaleTimeString() })
    }, 3000)

    this.setData({ isPolling: true })
  },

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
    this.setData({ isPolling: false })
  },

  // ========== 快速输入 ==========

  onQuickInput(e) {
    this.setData({ quickInput: e.detail.value })
  },

  onQuickSubmit() {
    const { quickInput, players, currentRoundScores } = this.data
    if (!quickInput.trim()) return

    // 中文数字映射
    const cnNumMap = { '一': '1', '二': '2', '两': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10' }

    // 预处理
    let text = quickInput.trim()
    Object.keys(cnNumMap).forEach(cn => {
      text = text.replace(new RegExp(cn, 'g'), cnNumMap[cn])
    })
    text = text.replace(/[分号]/g, '')  // 去掉"分"和"号"字

    // 解析结果暂存
    const parsedScores = []

    // 方式1: 按序号匹配 (1+5, 2-3, 1加5, 2减3)
    const numPattern = /(\d+)\s*([+\-加减])\s*(\d+)/g
    let match

    while ((match = numPattern.exec(text)) !== null) {
      const playerNum = parseInt(match[1])
      const op = match[2]
      const score = parseInt(match[3])

      if (playerNum >= 1 && playerNum <= players.length && score > 0) {
        const playerIndex = playerNum - 1
        const finalScore = (op === '-' || op === '减') ? -Math.abs(score) : Math.abs(score)

        parsedScores.push({
          playerIndex,
          playerId: players[playerIndex].id,
          playerName: players[playerIndex].name,
          score: finalScore
        })
      }
    }

    // 方式2: 按名字匹配 (小明加5, 阿呆减3)
    if (parsedScores.length === 0) {
      players.forEach((player, playerIndex) => {
        // 转义特殊字符
        const escapedName = player.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const namePattern = new RegExp(`${escapedName}\\s*([+\\-加减])\\s*(\\d+)`, 'g')
        let nameMatch

        while ((nameMatch = namePattern.exec(text)) !== null) {
          const op = nameMatch[1]
          const score = parseInt(nameMatch[2])

          if (score > 0) {
            const finalScore = (op === '-' || op === '减') ? -Math.abs(score) : Math.abs(score)

            parsedScores.push({
              playerIndex,
              playerId: player.id,
              playerName: player.name,
              score: finalScore
            })
          }
        }
      })
    }

    if (parsedScores.length === 0) {
      wx.showToast({ title: '没识别到，试试 1加5 或 小明加5', icon: 'none' })
      return
    }

    // 弹出确认窗口
    const summary = parsedScores.map(s => `${s.playerName} ${s.score > 0 ? '+' : ''}${s.score}`).join('\n')

    wx.showModal({
      title: `确认记分 (${parsedScores.length}笔)`,
      content: summary,
      confirmText: '确认',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.applyParsedScores(parsedScores)
        }
      }
    })
  },

  // 应用解析后的分数
  applyParsedScores(parsedScores) {
    const { players, currentRoundScores } = this.data
    let newPlayers = [...players]
    const addedScores = []

    parsedScores.forEach(item => {
      addedScores.push(item)
      newPlayers[item.playerIndex] = {
        ...newPlayers[item.playerIndex],
        total: newPlayers[item.playerIndex].total + item.score
      }
    })

    // 合并本轮所有分数
    const allRoundScores = [...currentRoundScores, ...addedScores]

    // 计算每个玩家本轮累计分数
    const roundPendingMap = {}
    allRoundScores.forEach(s => {
      roundPendingMap[s.playerId] = (roundPendingMap[s.playerId] || 0) + s.score
    })

    newPlayers = newPlayers.map(p => ({
      ...p,
      roundPending: roundPendingMap[p.id] || 0
    }))

    this.setData({
      players: newPlayers,
      currentRoundScores: allRoundScores,
      quickInput: '',
      customScore: ''
    })

    wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: `记了 ${newScores.length} 笔 ✅`, icon: 'none' })
  },

  // ========== 记分操作 ==========

  onSelectPlayer(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      selectedIndex: this.data.selectedIndex === index ? -1 : index
    })
  },

  onQuickScore(e) {
    const { selectedIndex, players, currentRoundScores } = this.data
    if (selectedIndex < 0) {
      wx.showToast({ title: '请先选玩家', icon: 'none' })
      return
    }

    const score = parseInt(e.currentTarget.dataset.score)
    const player = players[selectedIndex]

    const newScores = [...currentRoundScores, {
      playerIndex: selectedIndex,
      playerId: player.id,
      playerName: player.name,
      score: score
    }]

    // 计算每个玩家本轮累计分数
    const roundPendingMap = {}
    newScores.forEach(s => {
      roundPendingMap[s.playerId] = (roundPendingMap[s.playerId] || 0) + s.score
    })

    const newPlayers = players.map((p, i) => ({
      ...p,
      total: p.total + (i === selectedIndex ? score : 0),
      roundPending: roundPendingMap[p.id] || 0
    }))

    this.setData({
      players: newPlayers,
      currentRoundScores: newScores,
      customScore: ''
    })

    wx.vibrateShort({ type: 'light' })
  },

  onCustomInput(e) {
    this.setData({ customScore: e.detail.value })
  },

  onCustomScore() {
    const { selectedIndex, customScore } = this.data
    if (selectedIndex < 0) {
      wx.showToast({ title: '请先选玩家', icon: 'none' })
      return
    }

    const score = parseInt(customScore)
    if (isNaN(score) || score === 0) {
      wx.showToast({ title: '请输入有效分数', icon: 'none' })
      return
    }

    this.onQuickScore({
      currentTarget: { dataset: { score: score.toString() } }
    })
  },

  // ========== 确认本轮 ==========

  onConfirmRound() {
    const { currentRoundScores } = this.data

    if (currentRoundScores.length === 0) {
      wx.showToast({ title: '还没记分呢', icon: 'none' })
      return
    }

    const roundTotal = sum(currentRoundScores.map(s => s.score))
    if (roundTotal !== 0) {
      wx.showModal({
        title: '分数不对',
        content: `本轮总分为 ${roundTotal}，应该为 0。确定要继续吗？`,
        confirmText: '继续',
        cancelText: '修改',
        success: (res) => {
          if (res.confirm) {
            this.saveRound()
          }
        }
      })
    } else {
      this.saveRound()
    }
  },

  async saveRound() {
    const { isRoomMode, gameId, players, currentRoundScores, currentRound } = this.data

    if (isRoomMode) {
      wx.showLoading({ title: '提交中...' })

      const scoresToSubmit = currentRoundScores.map(s => ({
        playerId: s.playerId,
        score: s.score
      }))

      const success = await roomUtil.submitScores(this.data.roomId, scoresToSubmit)
      wx.hideLoading()

      if (success) {
        if (this.data.roomMode === 'collaborative') {
          await roomUtil.confirmRound(this.data.roomId)
        }
        wx.showToast({ title: '记录成功 ✅', icon: 'none' })
        await this.loadRoomData()
        this.setData({ currentRoundScores: [], selectedIndex: 0, customScore: '', voiceResult: '' })
      } else {
        wx.showToast({ title: '提交失败', icon: 'none' })
      }
    } else {
      const game = app.globalData.games.find(g => g.id === gameId)
      if (!game) return

      const round = {
        id: generateId(),
        roundNumber: currentRound,
        scores: currentRoundScores.map(s => ({
          playerId: s.playerId,
          playerName: s.playerName,
          score: s.score
        })),
        timestamp: new Date().toISOString()
      }

      game.rounds.push(round)
      app.saveGames()

      const newPlayers = players.map(p => {
        const lastRoundScore = currentRoundScores
          .filter(s => s.playerId === p.id)
          .reduce((sum, s) => sum + s.score, 0)
        return { ...p, lastRound: lastRoundScore, roundPending: 0 }
      })

      // 更新历史轮次（最近4轮）
      const roundHistory = game.rounds.slice(-4).reverse().map(r => ({
        roundNumber: r.roundNumber,
        scores: r.scores
      }))

      wx.showToast({ title: '记录成功 ✅', icon: 'none' })

      this.setData({
        players: newPlayers,
        currentRoundScores: [],
        currentRound: currentRound + 1,
        selectedIndex: 0,
        customScore: '',
        quickInput: '',
        roundHistory
      })
    }
  },

  // ========== 结束牌局 ==========

  onEndGame() {
    const { currentRoundScores } = this.data

    if (currentRoundScores.length > 0) {
      wx.showModal({
        title: '还有未保存的分数',
        content: '本轮有未确认的分数，要先保存吗？',
        confirmText: '保存并结束',
        cancelText: '直接结束',
        success: (res) => {
          if (res.confirm) {
            this.saveRound().then(() => this.endGame())
          } else {
            this.endGame()
          }
        }
      })
    } else {
      this.endGame()
    }
  },

  async endGame() {
    const { isRoomMode, gameId, roomId, players } = this.data

    if (isRoomMode) {
      this.stopPolling()
      await roomUtil.endRoom(roomId)
      wx.redirectTo({
        url: `/pages/result/result?roomId=${roomId}`
      })
    } else {
      const game = app.globalData.games.find(g => g.id === gameId)
      if (!game) return

      game.status = 'ended'
      game.endTime = new Date().toISOString()
      game.finalScores = players.map(p => ({
        playerId: p.id,
        playerName: p.name,
        total: p.total
      }))

      app.saveGames()
      wx.redirectTo({
        url: `/pages/result/result?gameId=${gameId}`
      })
    }
  },

  onShareAppMessage() {
    if (this.data.isRoomMode) {
      return {
        title: `胡乐房间 ${this.data.roomCode} - 快来一起记分！`,
        path: `/pages/join-room/join-room?roomCode=${this.data.roomCode}`
      }
    }
    return {
      title: '胡乐 - 打牌记分',
      path: '/pages/index/index'
    }
  }
})
