// 结算页逻辑
const app = getApp()
const { formatDate, formatScore } = require('../../utils/util')

Page({
  data: {
    gameId: '',
    roundCount: 0,
    playerCount: 0,
    rankings: [],
    roundDetails: [],
    playerColors: ['#E24B4A', '#185FA5', '#D85A30', '#3B6D11']
  },

  async onLoad(options) {
    if (options.gameId) {
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

  // 处理牌局数据
  processGameData(game) {
    const players = game.players
    const rounds = game.rounds

    // 计算每个玩家的总分、胜负、庄数、自摸数
    const playerStats = players.map((p, index) => {
      let total = 0
      let winRounds = 0
      let loseRounds = 0
      let dealerRounds = 0  // 庄：该轮赢钱的次数
      let selfDrawCount = 0 // 自摸：1赢3输的次数

      rounds.forEach(round => {
        const score = round.scores.find(s => s.playerId === p.id)
        if (score) {
          total += score.score
          if (score.score > 0) {
            winRounds++
            // 该轮该玩家是庄（赢钱了）
            dealerRounds++
          }
          if (score.score < 0) loseRounds++
        }

        // 自摸判断：本轮只有1个赢家
        const winners = round.scores.filter(s => s.score > 0).length
        const losers = round.scores.filter(s => s.score < 0).length
        if (winners === 1 && losers > 1) {
          const winner = round.scores.find(s => s.score > 0)
          if (winner && winner.playerId === p.id) {
            selfDrawCount++
          }
        }
      })

      // 计算平均每轮得分
      const avgScore = rounds.length > 0 ? Math.round(total / rounds.length * 10) / 10 : 0

      return {
        playerId: p.id,
        playerName: p.name,
        originalIndex: index,
        total,
        winRounds,
        loseRounds,
        avgScore,
        dealerRounds,
        selfDrawCount,
        // 自摸率（庄的次数中自摸占比）
        selfDrawRate: dealerRounds > 0 ? Math.round((selfDrawCount / dealerRounds) * 100) : 0
      }
    })

    // 按总分排序（高到低）
    const rankings = [...playerStats].sort((a, b) => b.total - a.total)

    // 找出最大赢家和最大输家
    const totalStats = {
      maxWinner: rankings[0],
      maxLoser: rankings[rankings.length - 1]
    }

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
      roundDetails,
      totalStats
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
      const { rankings, roundCount, playerCount, totalStats } = this.data

      // 计算画布高度：标题90 + 排名 + 统计 + 底部
      const rankingHeight = 130 + rankings.length * 80
      const statsHeight = 120 + rankings.length * 110 + 40
      const totalHeight = rankingHeight + statsHeight + 30

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
          const canvasH = totalHeight
          canvas.width = 375 * dpr
          canvas.height = canvasH * dpr
          ctx.scale(dpr, dpr)

          // 绘制背景
          const gradient = ctx.createLinearGradient(0, 0, 0, canvasH)
          gradient.addColorStop(0, '#FFF0F5')
          gradient.addColorStop(0.3, '#FFFFFF')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, 375, canvasH)

          // 绘制标题
          ctx.fillStyle = '#E24B4A'
          ctx.font = 'bold 28px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('🏆 胡乐麻战绩', 187.5, 60)

          ctx.fillStyle = '#888780'
          ctx.font = '14px sans-serif'
          ctx.fillText(`${playerCount}人局 · ${roundCount}轮 · ${formatDate(new Date())}`, 187.5, 90)

          // 绘制排名
          rankings.forEach((player, index) => {
            const y = 130 + index * 80

            // 背景卡片
            ctx.fillStyle = index === 0 ? '#FFF0F5' : '#FFFFFF'
            ctx.strokeStyle = index === 0 ? '#F4C0D1' : '#E0E0E0'
            ctx.lineWidth = 1
            this.roundRect(ctx, 20, y, 335, 65, 12)
            ctx.fill()
            ctx.stroke()

            // 排名徽章
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
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

          // 绘制麻将统计
          let statsY = rankingHeight + 40

          // 标题
          ctx.fillStyle = '#5F5E5A'
          ctx.font = 'bold 16px sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText('📊 麻将统计', 20, statsY)

          statsY += 30

          // 最大赢家 / 最大输家
          const winX = 20, loseX = 190, cardW = 165, cardH = 70

          // 最大赢家卡片
          ctx.fillStyle = '#FFF0F5'
          ctx.strokeStyle = '#F4C0D1'
          ctx.lineWidth = 1
          this.roundRect(ctx, winX, statsY, cardW, cardH, 12)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#888780'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('🔥 最大赢家', winX + cardW / 2, statsY + 20)

          ctx.fillStyle = '#2C2C2A'
          ctx.font = 'bold 15px sans-serif'
          ctx.fillText(totalStats.maxWinner.playerName, winX + cardW / 2, statsY + 40)

          ctx.fillStyle = '#E24B4A'
          ctx.font = 'bold 18px sans-serif'
          ctx.fillText('+' + totalStats.maxWinner.total, winX + cardW / 2, statsY + 60)

          // 最大输家
          ctx.fillStyle = '#E8F0FE'
          ctx.strokeStyle = '#B5D4F4'
          ctx.lineWidth = 1
          this.roundRect(ctx, loseX, statsY, cardW, cardH, 12)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#888780'
          ctx.font = '11px sans-serif'
          ctx.fillText('💨 最大输家', loseX + cardW / 2, statsY + 20)

          ctx.fillStyle = '#2C2C2A'
          ctx.font = 'bold 15px sans-serif'
          ctx.fillText(totalStats.maxLoser.playerName, loseX + cardW / 2, statsY + 40)

          ctx.fillStyle = '#185FA5'
          ctx.font = 'bold 18px sans-serif'
          ctx.fillText(String(totalStats.maxLoser.total), loseX + cardW / 2, statsY + 60)

          statsY += 90

          // 每人统计卡片
          rankings.forEach((player, index) => {
            const y = statsY + index * 105

            // 卡片背景
            ctx.fillStyle = '#FFFFFF'
            ctx.strokeStyle = '#E0E0E0'
            ctx.lineWidth = 1
            this.roundRect(ctx, 20, y, 335, 95, 12)
            ctx.fill()
            ctx.stroke()

            // 头像
            const colors = ['#E24B4A', '#185FA5', '#D85A30', '#3B6D11', '#AF52DE', '#FF9500', '#5AC8FA', '#34C759']
            ctx.fillStyle = colors[index % colors.length]
            ctx.beginPath()
            ctx.arc(42, y + 28, 18, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 14px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(player.playerName[0], 42, y + 33)

            // 名字 + 总分
            ctx.fillStyle = '#2C2C2A'
            ctx.font = 'bold 15px sans-serif'
            ctx.textAlign = 'left'
            ctx.fillText(player.playerName, 68, y + 25)

            ctx.fillStyle = player.total > 0 ? '#E24B4A' : player.total < 0 ? '#185FA5' : '#888780'
            ctx.font = 'bold 17px sans-serif'
            ctx.textAlign = 'right'
            ctx.fillText(formatScore(player.total), 340, y + 25)

            // 四格统计
            const gridY = y + 42
            const colW = 335 / 4
            const items = [
              { label: '胜率', value: `${roundCount > 0 ? Math.round(player.winRounds / roundCount * 100) : 0}%` },
              { label: '平均', value: `${player.avgScore > 0 ? '+' : ''}${player.avgScore}` },
              { label: '庄', value: `${player.dealerRounds}次` },
              { label: '自摸', value: `${player.selfDrawCount}次` }
            ]

            items.forEach((item, i) => {
              ctx.fillStyle = '#2C2C2A'
              ctx.font = 'bold 16px sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText(item.value, 20 + colW * i + colW / 2, gridY + 20)
              ctx.fillStyle = '#888780'
              ctx.font = '11px sans-serif'
              ctx.fillText(item.label, 20 + colW * i + colW / 2, gridY + 40)
            })
          })

          // 底部文字
          const bottomY = statsY + rankings.length * 105 + 20
          ctx.fillStyle = '#888780'
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('来自「胡乐麻」打牌记分小程序', 187.5, bottomY)

          // 导出图片
          try {
            const tempPath = await new Promise((resolve, reject) => {
              wx.canvasToTempFilePath({
                canvas,
                x: 0,
                y: 0,
                width: 375,
                height: canvasH,
                destWidth: 750,
                destHeight: canvasH * 2,
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
