// 个人中心逻辑
const app = getApp()
const { generateId } = require('../../utils/util')
const themeUtil = require('../../utils/theme')

Page({
  data: {
    userName: '',
    avatarUrl: '',
    userId: '',
    stats: {
      totalGames: 0,
      wins: 0,
      maxWinStreak: 0,
      totalScore: 0
    },
    winRate: 0,
    topOpponents: [],
    opponentColors: ['#007AFF', '#34C759', '#AF52DE', '#FF9500'],
    // 主题相关
    showThemeModal: false,
    themeList: [],
    currentThemeKey: 'ios23',
    currentThemeName: 'iOS 23',
    themeClass: 'theme-ios23'
  },

  onShow() {
    // 设置 tab 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }

    // 加载主题设置
    this.loadTheme()
    this.loadProfile()

    // 启用分享菜单（好友 + 朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  loadProfile() {
    const currentUser = app.globalData.currentUser
    const userName = currentUser ? (currentUser.name || '') : ''
    const avatarUrl = currentUser ? (currentUser.avatar || '') : ''
    const userId = currentUser ? (currentUser.id || '') : ''

    // 加载战绩统计
    const stats = app.getStats()

    // 计算胜率
    const winRate = stats.totalGames > 0
      ? Math.round((stats.wins / stats.totalGames) * 100)
      : 0

    // 计算常见牌友
    const topOpponents = this.calcTopOpponents()

    this.setData({ userName, avatarUrl, userId, stats, winRate, topOpponents })
  },

  // 选择头像（微信官方按钮回调）
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl
    if (!avatarUrl) return

    console.log('选择头像:', avatarUrl)

    // 本地显示
    this.setData({ avatarUrl })

    // 保存到用户信息
    app.globalData.currentUser.avatar = avatarUrl
    app.saveCurrentUser()

    wx.showToast({ title: '头像已更新 ✅', icon: 'none', duration: 1000 })
  },

  // 昵称输入（type="nickname" 选择微信昵称时也会触发）
  onNicknameInput(e) {
    const name = e.detail.value.trim()
    this.setData({ userName: name })
    // 选择微信昵称后立即保存（不等失焦）
    if (name && app.globalData.currentUser && name !== app.globalData.currentUser.name) {
      app.globalData.currentUser.name = name
      app.saveCurrentUser()
    }
  },

  // 昵称失焦保存（兜底）
  onNicknameBlur(e) {
    const name = e.detail.value.trim()
    if (name && app.globalData.currentUser && name !== app.globalData.currentUser.name) {
      app.globalData.currentUser.name = name
      app.saveCurrentUser()
      wx.showToast({ title: '昵称已保存', icon: 'none', duration: 1000 })
    }
  },

  // 计算常见牌友
  calcTopOpponents() {
    const games = app.globalData.games.filter(g => g.status === 'ended')
    const currentUser = app.globalData.currentUser
    if (!currentUser) return []

    const opponentMap = {}
    var myName = currentUser.name || ''

    games.forEach(game => {
      if (!game.finalScores) return

      game.finalScores.forEach(score => {
        // 跳过自己（ID 或名字匹配）
        if (score.playerId === currentUser.id) return
        if (myName && score.playerName === myName) return

        if (!opponentMap[score.playerId]) {
          opponentMap[score.playerId] = {
            playerId: score.playerId,
            name: score.playerName,
            games: 0,
            totalScore: 0
          }
        }

        opponentMap[score.playerId].games++
        opponentMap[score.playerId].totalScore += score.total
      })
    })

    return Object.values(opponentMap)
      .sort((a, b) => b.games - a.games)
      .slice(0, 5)
  },

  // 退出登录（清除个人数据，保留用户ID）
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '将清除昵称、头像和历史记录，用户ID会保留。确定退出？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 清除个人数据，保留用户ID
          app.globalData.games = []
          app.globalData.players = []
          app.globalData.currentUser = {
            ...app.globalData.currentUser,
            name: '',
            avatar: ''
          }

          app.saveGames()
          app.savePlayers()
          app.saveCurrentUser()

          wx.showToast({ title: '已退出', icon: 'none' })
          this.loadProfile()
        }
      }
    })
  },

  // ========== 主题相关 ==========

  // 加载主题设置
  loadTheme() {
    const themeList = themeUtil.getThemeList()
    const currentThemeKey = themeUtil.getCurrentThemeKey()
    const currentTheme = themeUtil.getCurrentTheme()
    const themeClass = currentTheme.className

    this.setData({
      themeList,
      currentThemeKey,
      currentThemeName: currentTheme.name,
      themeClass
    })
  },

  // 打开主题选择弹窗
  onGoTheme() {
    this.setData({ showThemeModal: true })
  },

  // 关闭主题选择弹窗
  onCloseThemeModal() {
    this.setData({ showThemeModal: false })
  },

  // 选择主题
  onSelectTheme(e) {
    const key = e.currentTarget.dataset.key
    const theme = themeUtil.THEMES[key]

    if (!theme) return

    // 保存主题
    themeUtil.setTheme(key)

    this.setData({
      currentThemeKey: key,
      currentThemeName: theme.name,
      themeClass: theme.className,
      showThemeModal: false
    })

    wx.showToast({ title: `已切换为${theme.name}`, icon: 'none' })
  },

  // ========== 跳转 ==========

  // 跳转到历史记录
  onGoHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    })
  },

  // 跳转到小程序简介（落地页）
  onGoAbout() {
    wx.navigateTo({
      url: '/pages/share-page/share-page'
    })
  },

  // ========== 数据导出/导入 ==========

  // 导出数据到剪贴板
  onExportClipboard() {
    const data = this._packExportData()
    if (!data) return

    wx.setClipboardData({
      data: data
      // wx.setClipboardData 自带"已复制"提示，不需要额外 toast
    })
  },

  // 导出 Excel（CSV 格式，Excel 可直接打开）
  onExportFile() {
    const games = app.globalData.games
    if (!games || games.length === 0) {
      wx.showToast({ title: '还没有牌局数据可导出', icon: 'none' })
      return
    }

    const endedGames = games.filter(g => g.status === 'ended')
    if (endedGames.length === 0) {
      wx.showToast({ title: '还没有已结束的牌局', icon: 'none' })
      return
    }

    // BOM + CSV 内容（Excel 打开中文不乱码）
    const BOM = '\uFEFF'
    const lines = []

    // sep= 告诉 Excel 用逗号分列（部分系统默认用分号）
    lines.push('sep=,')

    // 表头：牌局汇总
    lines.push('=== 牌局汇总 ===')
    lines.push('日期,时间,人数,轮数,玩家1,分数1,玩家2,分数2,玩家3,分数3,玩家4,分数4,赢家')

    endedGames.forEach(game => {
      const d = new Date(game.endTime || game.startTime)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      const players = game.players || []
      const scores = game.finalScores || []
      const sorted = [...scores].sort((a, b) => b.total - a.total)
      const winner = sorted[0]?.playerName || ''

      const cols = [date, time, players.length, game.rounds?.length || 0]
      // 最多4个玩家的分数
      for (let i = 0; i < 4; i++) {
        if (sorted[i]) {
          cols.push(sorted[i].playerName, sorted[i].total)
        } else {
          cols.push('', '')
        }
      }
      cols.push(winner)

      lines.push(cols.join(','))
    })

    // 空行分隔
    lines.push('')
    lines.push('=== 逐轮详情 ===')
    lines.push('牌局日期,轮次,玩家,分数')

    endedGames.forEach(game => {
      const d = new Date(game.endTime || game.startTime)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      ;(game.rounds || []).forEach(round => {
        // 同一轮同一玩家的分数汇总
        const playerTotals = {}
        ;(round.scores || []).forEach(s => {
          playerTotals[s.playerName] = (playerTotals[s.playerName] || 0) + s.score
        })
        Object.entries(playerTotals).forEach(([name, score]) => {
          lines.push(`${date},第${round.roundNumber}轮,${name},${score}`)
        })
      })
    })

    const csv = BOM + lines.join('\n')
    const fileName = `胡乐战绩-${this._formatDate(new Date())}.csv`
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName

    try {
      const fs = wx.getFileSystemManager()
      fs.writeFileSync(filePath, csv, 'utf8')

      wx.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: () => {
          wx.showToast({ title: '分享成功，用 Excel 打开即可', icon: 'none', duration: 2000 })
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('cancel')) return
          // 分享失败，回退到剪贴板
          wx.setClipboardData({
            data: csv,
            success: () => {
              wx.showModal({
                title: '文件分享不可用',
                content: '已改为复制到剪贴板，打开 Excel 粘贴即可。',
                showCancel: false,
                confirmText: '知道了'
              })
            }
          })
        }
      })
    } catch (err) {
      wx.showToast({ title: '导出失败: ' + (err.errMsg || err.message), icon: 'none' })
    }
  },

  // 从剪贴板导入数据
  onImportData() {
    wx.getClipboardData({
      success: (res) => {
        const text = res.data
        if (!text || !text.trim()) {
          wx.showToast({ title: '剪贴板为空', icon: 'none' })
          return
        }

        try {
          const parsed = JSON.parse(text)

          // 验证数据格式
          if (!parsed.games || !Array.isArray(parsed.games)) {
            wx.showToast({ title: '数据格式不对，需要胡乐导出的数据', icon: 'none' })
            return
          }

          // 验证 app 字段（防止导入其他应用的 JSON）
          if (parsed.app !== 'hule-mahjong') {
            wx.showToast({ title: '这不是胡乐的备份数据', icon: 'none' })
            return
          }

          // 过滤结构不完整的 game（缺关键字段会导致页面报错）
          const validGames = parsed.games.filter(g =>
            g && g.id && g.players && Array.isArray(g.players) && g.rounds && Array.isArray(g.rounds)
          )
          const invalidCount = parsed.games.length - validGames.length
          if (validGames.length === 0) {
            wx.showToast({ title: '备份数据中没有有效牌局', icon: 'none' })
            return
          }
          parsed.games = validGames

          // 统计导入信息
          const importGames = parsed.games.length
          const importPlayers = parsed.players ? parsed.players.length : 0

          const skipHint = invalidCount > 0 ? `\n（跳过 ${invalidCount} 条损坏数据）` : ''
          wx.showModal({
            title: '确认导入',
            content: `将导入 ${importGames} 场牌局、${importPlayers} 个牌友。${skipHint}\n\n已有数据会被合并（同ID不重复）。`,
            confirmText: '导入',
            cancelText: '取消',
            success: (r) => {
              if (r.confirm) {
                this._mergeImportData(parsed)
                wx.showToast({ title: '导入成功 ✅', icon: 'none' })
                this.loadProfile()
              }
            }
          })
        } catch (e) {
          wx.showToast({ title: '剪贴板内容不是胡乐备份数据', icon: 'none' })
        }
      }
    })
  },

  // 打包导出数据
  _packExportData() {
    const games = app.globalData.games
    const players = app.globalData.players
    const currentUser = app.globalData.currentUser

    if (!games || games.length === 0) {
      wx.showToast({ title: '还没有牌局数据可导出', icon: 'none' })
      return null
    }

    const exportObj = {
      app: 'hule-mahjong',
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      deviceInfo: {
        model: wx.getSystemInfoSync().model,
        system: wx.getSystemInfoSync().system
      },
      currentUser: currentUser,
      players: players,
      games: games
    }

    return JSON.stringify(exportObj, null, 2)
  },

  // 合并导入数据（同ID不重复）
  _mergeImportData(imported) {
    // 合并牌友
    if (imported.players && Array.isArray(imported.players)) {
      const existingPlayerIds = new Set(app.globalData.players.map(p => p.id))
      imported.players.forEach(p => {
        if (!existingPlayerIds.has(p.id)) {
          app.globalData.players.push(p)
        }
      })
      app.savePlayers()
    }

    // 合并牌局
    const existingGameIds = new Set(app.globalData.games.map(g => g.id))
    imported.games.forEach(g => {
      if (!existingGameIds.has(g.id)) {
        app.globalData.games.push(g)
      }
    })
    app.saveGames()

    // 合并用户信息（保留现有的，只补充缺失字段）
    if (imported.currentUser) {
      const current = app.globalData.currentUser || {}
      app.globalData.currentUser = {
        ...imported.currentUser,
        ...current  // 现有数据优先
      }
      app.saveCurrentUser()
    }
  },

  // 格式化日期（文件名用）
  _formatDate(d) {
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
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
