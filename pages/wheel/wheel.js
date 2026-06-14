// 大转盘逻辑
Page({
  data: {
    prizes: [],           // 奖品列表 [{name, color}]
    inputName: '',
    isSpinning: false,
    result: '',           // 转盘结果
    showResult: false,
    history: [],          // 历史记录
    showHistory: false,
    canvasReady: false,
    prizeColor: '#FF6B9D' // 第一个奖品颜色（历史记录用）
  },

  // 转盘颜色
  colors: [
    '#FF6B9D', '#FF8A80', '#FFB74D', '#FFD54F',
    '#AED581', '#4FC3F7', '#7986CB', '#BA68C8',
    '#F06292', '#4DD0E1'
  ],

  onLoad() {
    this.loadHistory()
    this.ctx = null
    this.animationTimer = null
  },

  onReady() {
    this.initCanvas()
  },

  onUnload() {
    if (this.animationTimer) clearTimeout(this.animationTimer)
  },

  // 初始化 Canvas
  initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#wheelCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = 300 * dpr
        canvas.height = 300 * dpr
        ctx.scale(dpr, dpr)
        this.canvas = canvas
        this.ctx = ctx
        this.setData({ canvasReady: true })
        this.drawWheel()
      })
  },

  // ========== 奖品管理 ==========

  onInputName(e) {
    this.setData({ inputName: e.detail.value })
  },

  onAddPrize() {
    const name = this.data.inputName.trim()
    if (!name) {
      wx.showToast({ title: '请输入奖品名称', icon: 'none' })
      return
    }
    if (this.data.prizes.length >= 10) {
      wx.showToast({ title: '最多10个奖品', icon: 'none' })
      return
    }
    if (this.data.prizes.some(p => p.name === name)) {
      wx.showToast({ title: '奖品重复了', icon: 'none' })
      return
    }

    const prizes = [...this.data.prizes, {
      name,
      color: this.colors[this.data.prizes.length % this.colors.length]
    }]
    this.setData({ prizes, inputName: '', prizeColor: prizes[0].color })
    this.drawWheel()
  },

  onRemovePrize(e) {
    const index = e.currentTarget.dataset.index
    const prizes = this.data.prizes.filter((_, i) => i !== index)
    // 重新分配颜色
    prizes.forEach((p, i) => { p.color = this.colors[i % this.colors.length] })
    this.setData({ prizes, prizeColor: prizes.length > 0 ? prizes[0].color : '#FF6B9D' })
    this.drawWheel()
  },

  // ========== 转盘绘制 ==========

  drawWheel(rotationDeg) {
    if (!this.ctx) return
    const ctx = this.ctx
    const prizes = this.data.prizes
    const cx = 150, cy = 150, r = 130

    // 清空
    ctx.clearRect(0, 0, 300, 300)

    if (prizes.length === 0) {
      // 空状态
      ctx.fillStyle = '#F5F5F5'
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#CCC'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('添加奖品后', cx, cy - 8)
      ctx.fillText('转盘自动出现', cx, cy + 12)
      return
    }

    const sliceAngle = (Math.PI * 2) / prizes.length
    const rotation = (rotationDeg || 0) * Math.PI / 180

    prizes.forEach((prize, i) => {
      const startAngle = rotation + i * sliceAngle - Math.PI / 2
      const endAngle = startAngle + sliceAngle

      // 扇形
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = prize.color
      ctx.fill()

      // 边框
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 2
      ctx.stroke()

      // 文字
      const midAngle = startAngle + sliceAngle / 2
      const textR = r * 0.65
      const tx = cx + Math.cos(midAngle) * textR
      const ty = cy + Math.sin(midAngle) * textR

      ctx.save()
      ctx.translate(tx, ty)
      ctx.rotate(midAngle + Math.PI / 2)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // 文字阴影
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 2
      ctx.fillText(prize.name, 0, 0)
      ctx.restore()
    })

    // 中心圆
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 2
    ctx.stroke()

    // 中心文字
    ctx.fillStyle = '#333'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('GO', cx, cy)

    // 指针（顶部三角形）
    ctx.beginPath()
    ctx.moveTo(cx - 12, cy - r - 8)
    ctx.lineTo(cx + 12, cy - r - 8)
    ctx.lineTo(cx, cy - r + 12)
    ctx.closePath()
    ctx.fillStyle = '#FF4757'
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.stroke()
  },

  // ========== 转盘动画 ==========

  onSpin() {
    if (this.data.isSpinning) return
    if (this.data.prizes.length < 2) {
      wx.showToast({ title: '至少需要2个奖品', icon: 'none' })
      return
    }

    this.setData({ isSpinning: true, showResult: false })

    // 随机选中奖品
    const prizes = this.data.prizes
    const winIndex = Math.floor(Math.random() * prizes.length)
    const sliceAngle = 360 / prizes.length

    // 计算目标角度：让指针指向 winIndex 扇区的中间
    // 指针在顶部(0度)，扇区从-90度开始
    // 目标：winIndex 扇区的中间对准指针
    const targetAngle = 360 - (winIndex * sliceAngle + sliceAngle / 2)

    // 加上多圈旋转（5-8圈）
    const extraSpins = (5 + Math.floor(Math.random() * 4)) * 360
    const totalDeg = extraSpins + targetAngle

    // 动画参数
    const duration = 4000  // 4秒
    const startTime = Date.now()
    const startDeg = 0

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // 缓动函数（先快后慢）
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentDeg = startDeg + totalDeg * eased

      this.drawWheel(currentDeg)

      if (progress < 1) {
        this.animationTimer = setTimeout(animate, 16)
      } else {
        // 动画结束
        this.setData({
          isSpinning: false,
          result: prizes[winIndex].name,
          showResult: true
        })

        // 震动反馈
        wx.vibrateShort({ type: 'heavy' })

        // 保存历史
        this.saveHistory(prizes[winIndex].name)
      }
    }

    animate()
  },

  // ========== 历史记录 ==========

  saveHistory(prizeName) {
    const history = wx.getStorageSync('wheelHistory') || []
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const timeStr = `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
    history.unshift({
      result: prizeName,
      time: now.toISOString(),
      timeStr: timeStr,
      prizes: this.data.prizes.map(p => p.name)
    })
    // 最多保留50条
    if (history.length > 50) history.length = 50
    wx.setStorageSync('wheelHistory', history)
    this.setData({ history })
  },

  loadHistory() {
    const history = wx.getStorageSync('wheelHistory') || []
    // 给旧数据补 timeStr
    history.forEach(h => {
      if (!h.timeStr && h.time) {
        const d = new Date(h.time)
        const pad = n => String(n).padStart(2, '0')
        h.timeStr = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      }
    })
    this.setData({ history })
  },

  onToggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  onClearHistory() {
    wx.showModal({
      title: '清空历史',
      content: '确定要清空所有转盘历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('wheelHistory')
          this.setData({ history: [] })
          wx.showToast({ title: '已清空', icon: 'none' })
        }
      }
    })
  },

  onCloseResult() {
    this.setData({ showResult: false })
  },

  // 跳过2个奖品的预设
  onQuickAdd(e) {
    const name = e.currentTarget.dataset.name
    if (this.data.prizes.length >= 10 || this.data.prizes.some(p => p.name === name)) return
    const prizes = [...this.data.prizes, {
      name,
      color: this.colors[this.data.prizes.length % this.colors.length]
    }]
    this.setData({ prizes, prizeColor: prizes[0].color })
    this.drawWheel()
  }
})
