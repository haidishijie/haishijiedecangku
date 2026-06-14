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
  },

  loadProfile() {
    const currentUser = app.globalData.currentUser
    const userName = currentUser ? currentUser.name : ''
    const avatarUrl = currentUser ? currentUser.avatar : ''
    const userId = currentUser ? currentUser.id : ''

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

  // 昵称输入
  onNicknameInput(e) {
    this.setData({ userName: e.detail.value })
  },

  // 昵称失焦保存
  onNicknameBlur(e) {
    const name = e.detail.value.trim()
    if (name && name !== app.globalData.currentUser?.name) {
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

    games.forEach(game => {
      const myScore = game.finalScores?.find(s => s.playerId === currentUser.id)
      if (!myScore) return

      game.finalScores.forEach(score => {
        if (score.playerId === currentUser.id) return

        if (!opponentMap[score.playerId]) {
          opponentMap[score.playerId] = {
            playerId: score.playerId,
            name: score.playerName,
            games: 0,
            myTotal: 0,
            theirTotal: 0
          }
        }

        opponentMap[score.playerId].games++
        opponentMap[score.playerId].myTotal += myScore.total
        opponentMap[score.playerId].theirTotal += score.total
      })
    })

    return Object.values(opponentMap)
      .map(o => ({ ...o, totalDiff: o.myTotal - o.theirTotal }))
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

  // ========== 数据导出/导入 ==========

  // 导出数据到剪贴板
  onExportClipboard() {
    const data = this._packExportData()
    if (!data) return

    wx.setClipboardData({
      data: data,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板，粘贴发送即可', icon: 'none', duration: 3000 })
      }
    })
  },

  // 保存备份文件到本地
  onExportFile() {
    const data = this._packExportData()
    if (!data) return

    const fs = wx.getFileSystemManager()
    const fileName = `hule-backup-${this._formatDate(new Date())}.json`
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName

    try {
      fs.writeFileSync(filePath, data, 'utf8')
      wx.showModal({
        title: '备份文件已保存',
        content: `文件名：${fileName}\n\n可通过微信「文件传输助手」发送给自己备份`,
        confirmText: '分享文件',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.shareFileMessage({
              filePath: filePath,
              fileName: fileName,
              success: () => {},
              fail: (err) => {
                if (!err.errMsg.includes('cancel')) {
                  wx.showToast({ title: '分享失败', icon: 'none' })
                }
              }
            })
          }
        }
      })
    } catch (err) {
      wx.showToast({ title: '保存失败: ' + err.errMsg, icon: 'none' })
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

          // 统计导入信息
          const importGames = parsed.games.length
          const importPlayers = parsed.players ? parsed.players.length : 0

          wx.showModal({
            title: '确认导入',
            content: `将导入 ${importGames} 场牌局、${importPlayers} 个牌友。\n\n已有数据会被合并（同ID不重复）。`,
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
  }
})
