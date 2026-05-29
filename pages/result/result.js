// 结算页逻辑
const app = getApp()
const { formatDate, formatScore } = require('../../utils/util')
const roomUtil = require('../../utils/room')

Page({
  data: {
    gameId: '',
    roomId: '',
    isRoomMode: false,
    roundCount: 0,
    playerCount: 0,
    rankings: [],
    roundDetails: [],
    playerColors: ['#E24B4A', '#185FA5', '#D85A30', '#3B6D11']
  },

  async onLoad(options) {
    // 支持 gameId（本地模式）和 roomId（房间模式）
    if (options.roomId) {
      this.setData({ roomId: options.roomId, isRoomMode: true })
      await this.loadRoomData(options.roomId)
    } else if (options.gameId) {
      this.setData({ gameId: options.gameId })
      const game = app.globalData.games.find(g => g.id === options.gameId)
      if (!game) {
        wx.showToast({ title: '牌局不存在', icon: 'none' })
        return
      }
      this.processGameData(game)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
    }
  },

  // 加载房间数据
  async loadRoomData(roomId) {
    try {
      const room = await roomUtil.getRoom(roomId)
      if (!room) {
        wx.showToast({ title: '房间不存在', icon: 'none' })
        return
      }

      // 转换为本地格式
      const game = {
        players: room.players || [],
        rounds: room.rounds || [],
        finalScores: (room.players || []).map(p => ({
          playerId: p.id,
          playerName: p.name,
          total: p.total || 0
        }))
      }

      this.processGameData(game)
    } catch (err) {
      console.error('加载房间数据失败:', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 处理牌局数据
  processGameData(game) {
    const players = game.players
    const rounds = game.rounds

    // 计算每个玩家的总分和胜负轮数
    const playerStats = players.map((p, index) => {
      let total = 0
      let winRounds = 0
      let loseRounds = 0

      rounds.forEach(round => {
        const score = round.scores.find(s => s.playerId === p.id)
        if (score) {
          total += score.score
          if (score.score > 0) winRounds++
          if (score.score < 0) loseRounds++
        }
      })

      return {
        playerId: p.id,
        playerName: p.name,
        originalIndex: index,
        total,
        winRounds,
        loseRounds
      }
    })

    // 按总分排序（高到低）
    const rankings = [...playerStats].sort((a, b) => b.total - a.total)

    // 处理逐轮详情
    const roundDetails = rounds.map(round => ({
      roundNumber: round.roundNumber,
      scores: round.scores.map(s => {
        const playerIndex = players.findIndex(p => p.id === s.playerId)
        return {
          ...s,
          originalIndex: playerIndex
        }
      })
    }))

    this.setData({
      roundCount: rounds.length,
      playerCount: players.length,
      rankings,
      roundDetails
    })
  },

  // 分享战绩
  onShare() {
    wx.showActionSheet({
      itemList: ['保存图片到相册', '分享给朋友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.saveImage()
        } else if (res.tapIndex === 1) {
          // 触发微信分享
          wx.showToast({ title: '请点击右上角分享', icon: 'none' })
        }
      }
    })
  },

  // 保存战绩图片
  async saveImage() {
    wx.showLoading({ title: '生成图片中...' })

    try {
      const { rankings, roundCount, playerCount } = this.data

      // 使用 canvas 生成图片
      const query = wx.createSelectorQuery()
      query.select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res[0]) {
            wx.hideLoading()
            wx.showToast({ title: '生成失败', icon: 'none' })
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          // 设置 canvas 大小
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = 375 * dpr
          canvas.height = 600 * dpr
          ctx.scale(dpr, dpr)

          // 绘制背景
          const gradient = ctx.createLinearGradient(0, 0, 0, 600)
          gradient.addColorStop(0, '#FFF0F5')
          gradient.addColorStop(0.3, '#FFFFFF')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, 375, 600)

          // 绘制标题
          ctx.fillStyle = '#E24B4A'
          ctx.font = 'bold 28px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('🏆 胡乐战绩', 187.5, 60)

          ctx.fillStyle = '#888780'
          ctx.font = '14px sans-serif'
          ctx.fillText(`${playerCount}人局 · ${roundCount}轮 · ${formatDate(new Date())}`, 187.5, 90)

          // 绘制排名
          rankings.forEach((player, index) => {
            const y = 130 + index * 80
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`

            // 背景卡片
            ctx.fillStyle = index === 0 ? '#FFF0F5' : '#FFFFFF'
            ctx.strokeStyle = index === 0 ? '#F4C0D1' : '#E0E0E0'
            ctx.lineWidth = 1
            this.roundRect(ctx, 20, y, 335, 65, 12)
            ctx.fill()
            ctx.stroke()

            // 排名
            ctx.fillStyle = '#2C2C2A'
            ctx.font = 'bold 20px sans-serif'
            ctx.textAlign = 'left'
            ctx.fillText(medal, 35, y + 40)

            // 名字
            ctx.fillStyle = '#2C2C2A'
            ctx.font = 'bold 16px sans-serif'
            ctx.fillText(player.playerName, 70, y + 35)

            // 胜负
            ctx.fillStyle = '#888780'
            ctx.font = '12px sans-serif'
            ctx.fillText(`赢${player.winRounds}轮 · 输${player.loseRounds}轮`, 70, y + 52)

            // 分数
            ctx.fillStyle = player.total > 0 ? '#E24B4A' : player.total < 0 ? '#185FA5' : '#888780'
            ctx.font = 'bold 24px sans-serif'
            ctx.textAlign = 'right'
            ctx.fillText(formatScore(player.total), 340, y + 42)
          })

          // 底部文字
          ctx.fillStyle = '#888780'
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('来自「胡乐」打牌记分小程序', 187.5, 570)

          // 导出图片
          try {
            const tempPath = await new Promise((resolve, reject) => {
              wx.canvasToTempFilePath({
                canvas,
                x: 0,
                y: 0,
                width: 375,
                height: 600,
                destWidth: 750,
                destHeight: 1200,
                success: (res) => resolve(res.tempFilePath),
                fail: reject
              })
            })

            // 保存到相册
            await wx.saveImageToPhotosAlbum({
              filePath: tempPath
            })

            wx.hideLoading()
            wx.showToast({ title: '已保存到相册 ✅', icon: 'none' })
          } catch (err) {
            wx.hideLoading()
            if (err.errMsg && err.errMsg.includes('auth deny')) {
              wx.showModal({
                title: '需要授权',
                content: '请允许保存图片到相册',
                confirmText: '去设置',
                success: (res) => {
                  if (res.confirm) wx.openSetting()
                }
              })
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' })
            }
          }
        })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  // 绘制圆角矩形
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  },

  // 回到首页
  onGoHome() {
    wx.navigateBack({
      delta: 10,
      fail: () => {
        wx.redirectTo({ url: '/pages/index/index' })
      }
    })
  },

  // 分享给朋友
  onShareAppMessage() {
    const { rankings, roundCount, playerCount } = this.data
    const winner = rankings[0]

    return {
      title: `🏆 ${winner.playerName}在${playerCount}人局中获胜！打了${roundCount}轮`,
      path: '/pages/index/index'
    }
  }
})
