// 排行榜逻辑
const app = getApp()
const themeUtil = require('../../utils/theme')

Page({
  data: {
    period: 'month', // month | quarter | year | all
    periodLabel: '',
    rankings: [],
    totalGames: 0,
    totalPlayers: 0,
    totalRounds: 0,
    avatarColors: ['#007AFF', '#34C759', '#AF52DE', '#FF9500'],
    themeClass: 'theme-ios23'
  },

  onShow() {
    // 设置 tab 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    // 加载主题
    const theme = themeUtil.getCurrentTheme()
    this.setData({ themeClass: theme.className })
    this.loadRankings()
  },

  // 切换时间范围
  onFilter(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ period })
    this.loadRankings()
  },

  // 加载排行榜
  loadRankings() {
    const { period } = this.data
    const games = app.globalData.games.filter(g => g.status === 'ended')

    // 按时间筛选
    const now = new Date()
    const filteredGames = games.filter(game => {
      const gameDate = new Date(game.endTime)

      switch (period) {
        case 'month':
          return gameDate.getMonth() === now.getMonth() &&
                 gameDate.getFullYear() === now.getFullYear()
        case 'quarter': {
          const currentQuarter = Math.floor(now.getMonth() / 3)
          const gameQuarter = Math.floor(gameDate.getMonth() / 3)
          return gameQuarter === currentQuarter &&
                 gameDate.getFullYear() === now.getFullYear()
        }
        case 'year':
          return gameDate.getFullYear() === now.getFullYear()
        case 'all':
        default:
          return true
      }
    })

    // 计算时间范围标签
    const periodLabel = this.getPeriodLabel(period, now)

    // 统计每个玩家的数据
    const playerMap = {}

    filteredGames.forEach(game => {
      game.finalScores?.forEach(score => {
        if (!playerMap[score.playerId]) {
          playerMap[score.playerId] = {
            playerId: score.playerId,
            name: score.playerName,
            totalGames: 0,
            wins: 0,
            totalScore: 0
          }
        }

        playerMap[score.playerId].totalGames++
        playerMap[score.playerId].totalScore += score.total
        if (score.total > 0) {
          playerMap[score.playerId].wins++
        }
      })
    })

    // 转换为数组并计算胜率
    const rankings = Object.values(playerMap)
      .map(p => ({
        ...p,
        winRate: p.totalGames > 0 ? Math.round((p.wins / p.totalGames) * 100) : 0
      }))
      .sort((a, b) => b.totalScore - a.totalScore)

    // 计算总统计
    let totalRounds = 0
    filteredGames.forEach(game => {
      totalRounds += game.rounds?.length || 0
    })

    const totalPlayers = Object.keys(playerMap).length

    this.setData({
      rankings,
      periodLabel,
      totalGames: filteredGames.length,
      totalPlayers,
      totalRounds
    })
  },

  // 获取时间范围标签
  getPeriodLabel(period, now) {
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const quarter = Math.floor(now.getMonth() / 3) + 1

    switch (period) {
      case 'month':
        return `${year}年${month}月`
      case 'quarter':
        return `${year}年第${quarter}季度`
      case 'year':
        return `${year}年`
      case 'all':
        return '全部时间'
      default:
        return ''
    }
  }
})
