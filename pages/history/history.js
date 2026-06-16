// 历史记录逻辑
const app = getApp()
const { formatDate, formatTime } = require('../../utils/util')

Page({
  data: {
    allGames: [],
    filteredGames: [],
    filter: 'all',
    totalGames: 0,
    totalRounds: 0,
    totalScore: 0
  },

  onShow() {
    this.loadGames()

    // 启用分享菜单（好友 + 朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  loadGames() {
    const allGames = app.getAllGames()
    const currentUser = app.globalData.currentUser
    const myId = currentUser ? currentUser.id : ''
    const myName = currentUser ? (currentUser.name || '') : ''

    let totalRounds = 0
    let totalScore = 0
    let totalWins = 0

    const processedGames = allGames.map(game => {
      var rounds = game.rounds || []
      var players = game.players || []
      totalRounds += rounds.length

      // 找自己的分数（ID 或名字匹配）
      var myScore = null
      var maxScore = -Infinity
      var winnerId = null

      if (game.finalScores) {
        for (var i = 0; i < game.finalScores.length; i++) {
          var s = game.finalScores[i]
          if (s.total > maxScore) {
            maxScore = s.total
            winnerId = s.playerId
          }
          if (s.playerId === myId || (myName && s.playerName === myName)) {
            myScore = s
          }
        }
      }

      var myTotal = myScore ? myScore.total : 0
      totalScore += myTotal

      // 判断当前用户是否是本局赢家
      var isWin = myScore && myScore.playerId === winnerId && maxScore > 0
      if (isWin) totalWins++

      // 排名（按分数高到低）
      const rankings = [...(game.finalScores || [])].sort((a, b) => b.total - a.total)
      const winner = rankings[0]?.playerName || '--'

      return {
        id: game.id,
        playerCount: players.length,
        roundCount: rounds.length,
        playerNames: players.map(p => p.name).join(' '),
        myScore: myTotal,
        isWin: isWin,
        rankings,
        winner,
        date: formatDate(game.endTime),
        time: formatTime(game.endTime)
      }
    })

    this.setData({
      allGames: processedGames,
      totalGames: processedGames.length,
      totalRounds,
      totalScore,
      totalWins: totalWins
    })

    this.applyFilter()
  },

  // 筛选
  onFilter(e) {
    const filter = e.currentTarget.dataset.type
    this.setData({ filter })
    this.applyFilter()
  },

  applyFilter() {
    const { allGames, filter } = this.data
    let filteredGames = allGames

    if (filter === 'win') {
      filteredGames = allGames.filter(g => g.isWin)
    } else if (filter === 'lose') {
      filteredGames = allGames.filter(g => !g.isWin)
    }

    this.setData({ filteredGames })
  },

  // 查看牌局详情
  onGameDetail(e) {
    const gameId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/result/result?gameId=${gameId}`
    })
  },

  // 删除单条牌局记录
  onDeleteGame(e) {
    const gameId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除这条牌局记录吗？',
      confirmText: '删除',
      confirmColor: '#E24B4A',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 从 globalData 中删除
          const games = app.globalData.games
          const index = games.findIndex(g => g.id === gameId)
          if (index !== -1) {
            games.splice(index, 1)
            app.saveGames()
          }
          // 重新加载列表
          this.loadGames()
          wx.showToast({ title: '已删除', icon: 'none' })
        }
      }
    })
  },

  // 分享给朋友
  onShareAppMessage() {
    return {
      title: '我在用胡乐麻记分，打牌再也不怕算错账了！',
      path: '/pages/share-page/share-page'
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '我在用胡乐麻记分，打牌再也不怕算错账了！',
      path: '/pages/share-page/share-page',
      query: ''
    }
  }
})
