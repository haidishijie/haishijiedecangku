// 房间管理模块（小程序端直接操作云数据库）
const app = getApp()

const COLLECTION = 'rooms'

/**
 * 获取数据库实例
 */
const getDB = () => {
  return wx.cloud.database()
}

/**
 * 生成房间号
 */
const generateRoomCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

/**
 * 创建房间
 */
const createRoom = async (options) => {
  const db = getDB()
  const currentUser = app.globalData.currentUser

  // 生成房间号，检查碰撞，最多重试3次
  let roomCode = generateRoomCode()
  let attempts = 0
  const MAX_ATTEMPTS = 3

  while (attempts < MAX_ATTEMPTS) {
    const existing = await db.collection(COLLECTION)
      .where({ roomCode, status: 'playing' })
      .get()

    if (existing.data.length === 0) break

    roomCode = generateRoomCode()
    attempts++
  }

  const room = {
    roomCode,
    mode: options.mode,
    status: 'playing',
    creatorId: currentUser.id,
    creatorName: currentUser.name,
    players: [{
      id: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar || '',
      total: 0
    }],
    rounds: [],
    currentRound: 1,
    pendingScores: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  try {
    const res = await db.collection(COLLECTION).add({ data: room })
    wx.setStorageSync('currentRoomId', res._id)
    wx.setStorageSync('currentRoomCode', roomCode)
    return { roomId: res._id, roomCode }
  } catch (err) {
    console.error('创建房间失败:', err)
    throw err
  }
}

/**
 * 加入房间
 */
const joinRoom = async (roomCode, playerName) => {
  const db = getDB()
  const currentUser = app.globalData.currentUser

  try {
    const res = await db.collection(COLLECTION)
      .where({ roomCode, status: 'playing' })
      .get()

    if (res.data.length === 0) {
      wx.showToast({ title: '房间不存在或已结束', icon: 'none' })
      return null
    }

    const room = res.data[0]

    // 检查是否已在房间
    const alreadyIn = room.players.some(p => p.id === currentUser.id)
    if (!alreadyIn) {
      const _ = db.command
      await db.collection(COLLECTION).doc(room._id).update({
        data: {
          players: _.push({
            id: currentUser.id,
            name: playerName,
            avatar: currentUser.avatar || '',
            total: 0
          }),
          updatedAt: new Date().toISOString()
        }
      })
    }

    wx.setStorageSync('currentRoomId', room._id)
    wx.setStorageSync('currentRoomCode', roomCode)

    return { roomId: room._id, room }
  } catch (err) {
    console.error('加入房间失败:', err)
    wx.showToast({ title: '加入失败', icon: 'none' })
    return null
  }
}

/**
 * 获取房间信息
 */
const getRoom = async (roomId) => {
  const db = getDB()

  try {
    const res = await db.collection(COLLECTION).doc(roomId).get()
    return res.data
  } catch (err) {
    console.error('获取房间失败:', err)
    return null
  }
}

/**
 * 提交记分
 */
const submitScores = async (roomId, scores) => {
  const db = getDB()
  const _ = db.command
  const currentUser = app.globalData.currentUser

  try {
    await db.collection(COLLECTION).doc(roomId).update({
      data: {
        pendingScores: _.push({
          submitterId: currentUser.id,
          submitterName: currentUser.name,
          scores,
          timestamp: new Date().toISOString()
        }),
        updatedAt: new Date().toISOString()
      }
    })
    return true
  } catch (err) {
    console.error('提交记分失败:', err)
    return false
  }
}

/**
 * 确认本轮
 */
const confirmRound = async (roomId) => {
  const db = getDB()
  const _ = db.command

  try {
    const room = await getRoom(roomId)
    if (!room) return false

    // 合并所有 pendingScores
    const mergedScores = {}
    room.pendingScores.forEach(ps => {
      ps.scores.forEach(s => {
        if (!mergedScores[s.playerId]) {
          mergedScores[s.playerId] = 0
        }
        mergedScores[s.playerId] += s.score
      })
    })

    // 构造本轮数据
    const roundScores = Object.entries(mergedScores).map(([playerId, score]) => {
      const player = room.players.find(p => p.id === playerId)
      return {
        playerId,
        playerName: player ? player.name : '未知',
        score
      }
    })

    const newRound = {
      roundNumber: room.currentRound,
      scores: roundScores,
      timestamp: new Date().toISOString()
    }

    // 更新玩家总分
    const updatedPlayers = room.players.map(p => ({
      ...p,
      total: p.total + (mergedScores[p.id] || 0)
    }))

    await db.collection(COLLECTION).doc(roomId).update({
      data: {
        rounds: _.push(newRound),
        players: updatedPlayers,
        currentRound: _.inc(1),
        pendingScores: [],
        updatedAt: new Date().toISOString()
      }
    })

    return true
  } catch (err) {
    console.error('确认本轮失败:', err)
    return false
  }
}

/**
 * 结束房间
 */
const endRoom = async (roomId) => {
  const db = getDB()

  try {
    await db.collection(COLLECTION).doc(roomId).update({
      data: {
        status: 'ended',
        updatedAt: new Date().toISOString()
      }
    })

    wx.removeStorageSync('currentRoomId')
    wx.removeStorageSync('currentRoomCode')
    return true
  } catch (err) {
    console.error('结束房间失败:', err)
    return false
  }
}

/**
 * 轮询获取房间最新数据
 */
const pollRoom = async (roomId) => {
  return await getRoom(roomId)
}

/**
 * 离开房间
 */
const leaveRoom = () => {
  wx.removeStorageSync('currentRoomId')
  wx.removeStorageSync('currentRoomCode')
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  submitScores,
  confirmRound,
  endRoom,
  pollRoom,
  leaveRoom
}
