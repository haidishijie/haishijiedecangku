// 疯狂骰子
var app = getApp()

Page({
  data: {
    diceCount: 2,        // 骰子数量 1-4
    diceValues: [1, 3],  // 当前骰子面值
    total: 0,            // 本轮总点数
    isRolling: false,
    rollCount: 0,        // 总投掷次数
    showHistory: false,
    history: [],         // 历史记录
    stats: {
      maxTotal: 0,
      maxDice: [],
      minTotal: 99,
      minDice: []
    }
  },

  onLoad: function() {
    this.loadHistory()
    // 投一次欢迎骰子
    this._rollOnce(false)
  },

  // ★ 页面退出时清理动画定时器
  onUnload: function() {
    if (this._rollInterval) {
      clearInterval(this._rollInterval)
      this._rollInterval = null
    }
  },

  // ========== 骰子数量选择 ==========

  onSelectDiceCount: function(e) {
    if (this.data.isRolling) return
    var count = parseInt(e.currentTarget.dataset.count)
    var dice = []
    for (var i = 0; i < count; i++) {
      dice.push(Math.floor(Math.random() * 6) + 1)
    }
    var total = 0
    for (var j = 0; j < dice.length; j++) {
      total += dice[j]
    }
    this.setData({
      diceCount: count,
      diceValues: dice,
      total: total,
      showResult: false
    })
  },

  // ========== 投掷 ==========

  onRoll: function() {
    if (this.data.isRolling) return
    this._rollOnce(true)
  },

  // 单次投掷逻辑
  _rollOnce: function(saveHistory) {
    this.setData({ isRolling: true, showResult: false })

    var count = this.data.diceCount
    var finalValues = []
    for (var i = 0; i < count; i++) {
      finalValues.push(Math.floor(Math.random() * 6) + 1)
    }

    var self = this
    var frames = 0
    var maxFrames = 12  // 约 1 秒动画

    // ★ 存储到 this 上，方便 onUnload 清理
    if (this._rollInterval) clearInterval(this._rollInterval)

    // 动画：快速切换随机值
    this._rollInterval = setInterval(function() {
      var tempValues = []
      for (var i = 0; i < count; i++) {
        tempValues.push(Math.floor(Math.random() * 6) + 1)
      }
      var tempTotal = 0
      for (var j = 0; j < tempValues.length; j++) {
        tempTotal += tempValues[j]
      }
      self.setData({
        diceValues: tempValues,
        total: tempTotal
      })
      frames++

      if (frames >= maxFrames) {
        clearInterval(self._rollInterval)
        self._rollInterval = null
        // 最终结果
        var finalTotal = 0
        for (var k = 0; k < finalValues.length; k++) {
          finalTotal += finalValues[k]
        }
        self.setData({
          diceValues: finalValues,
          total: finalTotal,
          isRolling: false,
          showResult: true
        })

        // 震动反馈
        wx.vibrateShort({ type: 'light' })

        if (saveHistory) {
          self._saveHistory(finalValues, finalTotal)
        }

        // 更新 stats
        var stats = self.data.stats
        if (finalTotal > stats.maxTotal) {
          stats.maxTotal = finalTotal
          stats.maxDice = finalValues.slice()
        }
        if (finalTotal < stats.minTotal) {
          stats.minTotal = finalTotal
          stats.minDice = finalValues.slice()
        }
        self.setData({ stats: stats })
      }
    }, 80)  // 每 80ms 变换一次
  },

  // ========== 历史记录 ==========

  _saveHistory: function(values, total) {
    var history = wx.getStorageSync('diceHistory') || []
    var now = new Date()
    var pad = function(n) { return String(n).padStart(2, '0') }
    var timeStr = pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes())

    history.unshift({
      diceCount: this.data.diceCount,
      values: values,
      total: total,
      time: now.toISOString(),
      timeStr: timeStr
    })

    // 最多保留 100 条
    if (history.length > 100) history.length = 100
    wx.setStorageSync('diceHistory', history)

    var rollCount = this.data.rollCount + 1
    this.setData({
      history: history,
      rollCount: rollCount
    })
  },

  loadHistory: function() {
    var history = wx.getStorageSync('diceHistory') || []
    // 补 timeStr
    for (var i = 0; i < history.length; i++) {
      var h = history[i]
      if (!h.timeStr && h.time) {
        var d = new Date(h.time)
        var pad = function(n) { return String(n).padStart(2, '0') }
        h.timeStr = pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
          ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      }
    }
    var rollCount = history.length
    var stats = { maxTotal: 0, maxDice: [], minTotal: 99, minDice: [] }

    for (var j = 0; j < history.length; j++) {
      var h = history[j]
      if (h.total > stats.maxTotal) {
        stats.maxTotal = h.total
        stats.maxDice = h.values || []
      }
      if (h.total < stats.minTotal) {
        stats.minTotal = h.total
        stats.minDice = h.values || []
      }
    }

    this.setData({
      history: history,
      rollCount: rollCount,
      stats: stats
    })
  },

  onToggleHistory: function() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  onClearHistory: function() {
    var self = this
    wx.showModal({
      title: '清空历史',
      content: '确定要清空所有骰子记录吗？',
      success: function(res) {
        if (res.confirm) {
          wx.removeStorageSync('diceHistory')
          self.setData({
            history: [],
            rollCount: 0,
            stats: { maxTotal: 0, maxDice: [], minTotal: 99, minDice: [] }
          })
          wx.showToast({ title: '已清空', icon: 'none' })
        }
      }
    })
  },

  onCloseResult: function() {
    this.setData({ showResult: false })
  }
})
