// 积分卡片组件
Component({
  properties: {
    playerName: { type: String, value: '' },
    playerInitial: { type: String, value: '' },
    color: { type: String, value: '#007AFF' },
    totalScore: { type: Number, value: 0 },
    roundScore: { type: Number, value: 0 },
    isLeading: { type: Boolean, value: false },
    rank: { type: Number, value: 0 }
  },

  data: {
    cardBg: 'rgba(255,255,255,0.72)'
  }
})
