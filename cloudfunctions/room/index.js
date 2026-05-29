// 云函数 - 房间管理
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const COLLECTION = 'rooms'

/**
 * 云函数入口
 */
exports.main = async (event, context) => {
  const { action, data } = event
  const wxContext = cloud.getWXContext()

  switch (action) {
    case 'create':
      return await createRoom(data, wxContext)
    case 'join':
      return await joinRoom(data, wxContext)
    case 'get':
      return await getRoom(data)
    case 'submitScores':
      return await submitScores(data, wxContext)
    case 'confirmRound':
      return await confirmRound(data)
    case 'end':
      return await endRoom(data)
    default:
      return { code: -1, msg: '未知操作' }
  }
}

// 生成 4 位房间号
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// 创建房间
async function createRoom(data, wxContext) {
  const { mode, players, creatorName } = data
  const roomCode = generateRoomCode()

  const room = {
    roomCode,
    mode,
    status: 'playing',
    creatorOpenId: wxContext.OPENID,
    creatorName,
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      total: 0
    })),
    rounds: [],
    currentRound: 1,
    pendingScores: [],
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }

  try {
    // 检查房间号是否重复
    const existing = await db.collection(COLLECTION)
      .where({ roomCode, status: 'playing' })
      .get()

    if (existing.data.length > 0) {
      // 重新生成
      room.roomCode = generateRoomCode()
    }

    const res = await db.collection(COLLECTION).add({ data: room })
    return { code: 0, data: { roomId: res._id, roomCode: room.roomCode } }
  } catch (err) {
    return { code: -1, msg: '创建失败', error: err.message }
  }
}

// 加入房间
async function joinRoom(data, wxContext) {
  const { roomCode, playerName, playerId } = data

  try {
    const res = await db.collection(COLLECTION)
      .where({ roomCode, status: 'playing' })
      .get()

    if (res.data.length === 0) {
      return { code: -1, msg: '房间不存在或已结束' }
    }

    const room = res.data[0]

    // 检查是否已在房间
    const alreadyIn = room.players.some(p => p.id === playerId)
    if (!alreadyIn) {
      await db.collection(COLLECTION).doc(room._id).update({
        data: {
          players: _.push({ id: playerId, name: playerName, total: 0 }),
          updatedAt: db.serverDate()
        }
      })
    }

    return { code: 0, data: { roomId: room._id, room } }
  } catch (err) {
    return { code: -1, msg: '加入失败', error: err.message }
  }
}

// 获取房间
async function getRoom(data) {
  const { roomId } = data

  try {
    const res = await db.collection(COLLECTION).doc(roomId).get()
    return { code: 0, data: res.data }
  } catch (err) {
    return { code: -1, msg: '获取失败', error: err.message }
  }
}

// 提交记分
async function submitScores(data, wxContext) {
  const { roomId, scores, submitterName } = data

  try {
    await db.collection(COLLECTION).doc(roomId).update({
      data: {
        pendingScores: _.push({
          submitterId: wxContext.OPENID,
          submitterName,
          scores,
          timestamp: db.serverDate()
        }),
        updatedAt: db.serverDate()
      }
    })
    return { code: 0, msg: '提交成功' }
  } catch (err) {
    return { code: -1, msg: '提交失败', error: err.message }
  }
}

// 确认本轮
async function confirmRound(data) {
  const { roomId } = data

  try {
    const roomRes = await db.collection(COLLECTION).doc(roomId).get()
    const room = roomRes.data

    // 合并 pendingScores
    const mergedScores = {}
    room.pendingScores.forEach(ps => {
      ps.scores.forEach(s => {
        if (!mergedScores[s.playerId]) {
          mergedScores[s.playerId] = 0
        }
        mergedScores[s.playerId] += s.score
      })
    })

    // 构造本轮
    const roundScores = Object.entries(mergedScores).map(([playerId, score]) => {
      const player = room.players.find(p => p.id === playerId)
      return { playerId, playerName: player ? player.name : '未知', score }
    })

    const newRound = {
      roundNumber: room.currentRound,
      scores: roundScores,
      timestamp: db.serverDate()
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
        updatedAt: db.serverDate()
      }
    })

    return { code: 0, msg: '确认成功' }
  } catch (err) {
    return { code: -1, msg: '确认失败', error: err.message }
  }
}

// 结束房间
async function endRoom(data) {
  const { roomId } = data

  try {
    await db.collection(COLLECTION).doc(roomId).update({
      data: {
        status: 'ended',
        updatedAt: db.serverDate()
      }
    })
    return { code: 0, msg: '已结束' }
  } catch (err) {
    return { code: -1, msg: '结束失败', error: err.message }
  }
}
