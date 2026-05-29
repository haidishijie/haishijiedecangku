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
  },

  loadGames() {
    const allGames = app.getAllGames()
    const currentUser = app.globalData.currentUser

    let totalRounds = 0
    let totalScore = 0

    const processedGames = allGames.map(game => {
      totalRounds += game.rounds.length

      const myScore = game.finalScores?.find(s => s.playerId === currentUser?.id)
      const myTotal = myScore ? myScore.total : 0
      totalScore += myTotal

      // 排名（按分数高到低）
      const rankings = [...(game.finalScores || [])].sort((a, b) => b.total - a.total)
      const winner = rankings[0]?.playerName || '--'

      return {
        id: game.id,
        playerCount: game.players.length,
        roundCount: game.rounds.length,
        playerNames: game.players.map(p => p.name).join(' '),
        myScore: myTotal,
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
      totalScore
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
      filteredGames = allGames.filter(g => g.myScore > 0)
    } else if (filter === 'lose') {
      filteredGames = allGames.filter(g => g.myScore < 0)
    }

    this.setData({ filteredGames })
  },

  // 查看牌局详情
  onGameDetail(e) {
    const gameId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/result/result?gameId=${gameId}`
    })
  }
})
