// 记分页逻辑（仅本地模式）
const app = getApp()
const { generateId, sum } = require('../../utils/util')

Page({
  data: {
    gameId: '',

    // 通用
    players: [],
    playerNamesStr: '',
    playerColors: ['#E24B4A', '#185FA5', '#D85A30', '#3B6D11', '#AF52DE', '#FF9500', '#5AC8FA', '#34C759'],
    currentRound: 1,
    selectedIndex: -1,
    currentRoundScores: [],
    customScore: '',
    quickInput: '',
    voiceResult: '',
    roundHistory: []
  },

  onLoad(options) {
    // 启用分享菜单（好友 + 朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })

    // 防止误触返回导致牌局数据丢失
    wx.enableAlertBeforeUnload()

    if (options.gameId) {
      this.initLocalMode(options)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
    }
  },

  // 页面切到后台时保存当前轮次（防止微信消息切换导致数据丢失）
  onHide() {
    const { gameId, currentRoundScores, currentRound, players } = this.data
    if (!gameId || currentRoundScores.length === 0) return

    const game = app.globalData.games.find(g => g.id === gameId)
    if (game) {
      game._pendingRound = {
        currentRound,
        currentRoundScores,
        players
      }
      app.saveGames()
    }
  },

  // 页面恢复时还原当前轮次
  onShow() {
    const { gameId } = this.data
    if (!gameId) return

    // 非首次加载（onLoad 已初始化）
    if (!this._initialized) {
      this._initialized = true
      return
    }

    const game = app.globalData.games.find(g => g.id === gameId)
    if (game && game._pendingRound) {
      const { currentRound, currentRoundScores, players } = game._pendingRound
      this.setData({
        currentRound,
        currentRoundScores,
        players
      })
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
      total: p.total || 0,
      lastRound: p.lastRound || 0,
      roundPending: 0
    }))

    // 获取最近4轮历史
    const roundHistory = game.rounds.slice(-4).reverse().map(round => ({
      roundNumber: round.roundNumber,
      scores: round.scores
    }))

    this.setData({
      gameId,
      players,
      playerNamesStr: players.map(p => p.name).join(' '),
      currentRound: game.rounds.length + 1,
      selectedIndex: -1,
      roundHistory
    })
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
    // 注意：两种模式合并，不再串行fallback，支持混合输入如"1加5小明减3"
    players.forEach((player, playerIndex) => {
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

  saveRound() {
    const { gameId, players, currentRoundScores, currentRound } = this.data

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

    const newPlayers = players.map(p => {
      const lastRoundScore = currentRoundScores
        .filter(s => s.playerId === p.id)
        .reduce((sum, s) => sum + s.score, 0)
      // total 已在 onQuickScore 中实时更新，这里只设 lastRound 和 roundPending
      return { ...p, lastRound: lastRoundScore, roundPending: 0 }
    })

    // 同步更新 game.players（保持 globalData 一致）
    game.players = newPlayers
    // 清除暂存的本轮数据（已保存）
    delete game._pendingRound
    app.saveGames()

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
      selectedIndex: -1,
      customScore: '',
      quickInput: '',
      roundHistory
    })
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
            this.saveRound()
            this.endGame()
          } else {
            this.endGame()
          }
        }
      })
    } else {
      this.endGame()
    }
  },

  endGame() {
    const { gameId } = this.data

    const game = app.globalData.games.find(g => g.id === gameId)
    if (!game) return

    // finalScores 必须从已保存的轮次数据计算，不能用 players.total
    // players.total 可能包含未保存轮次的分数，导致数据不一致
    const finalScores = game.players.map(p => {
      let total = 0
      game.rounds.forEach(round => {
        const playerScores = round.scores.filter(s => s.playerId === p.id)
        if (playerScores.length > 0) {
          total += playerScores.reduce((sum, s) => sum + s.score, 0)
        }
      })
      return {
        playerId: p.id,
        playerName: p.name,
        total
      }
    })

    game.status = 'ended'
    game.endTime = new Date().toISOString()
    game.finalScores = finalScores
    delete game._pendingRound

    app.saveGames()
    wx.redirectTo({
      url: `/pages/result/result?gameId=${gameId}`
    })
  },

  onShareAppMessage() {
    return {
      title: '胡乐 - 打牌记分',
      path: '/pages/index/index'
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '胡乐麻 - 打牌记分小程序',
      query: ''
    }
  }
})
