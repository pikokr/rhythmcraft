const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const uniqueString = require('unique-string')

const utils = require('../utils')
const setting = require('../setting.json')

const User = require('../schemas/user')
const File = require('../schemas/file')
const Comment = require('../schemas/comment')
const Like = require('../schemas/like')
const RemoveCommentVote = require('../schemas/remove_comment_vote')
const Item = require('../schemas/item')

// app 정의
const app = express.Router()

// bodyParser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.get('/workshop', async (req, res) => {
  let tags =
    typeof req.query.tags == 'string' ? [req.query.tags] : req.query.tags
  if (!tags) tags = []
  const regex = new RegExp(req.query.search || '', 'i')
  /**
   * @type {*}
   */
  let or = [
    { file_type: 'note', public: true, originalname: { $regex: regex } },
    { file_type: 'note', public: true, workshop_title: { $regex: regex } },
    { file_type: 'note', public: true, description: { $regex: regex } },
  ]
  or = { $or: or }

  const match = []

  tags.forEach(
    /**
     * @param {string} tag
     */
    (tag) => {
      const regex = new RegExp(tag, 'i')
      match.push({ file_type: 'note', public: true, tags: { $regex: regex } })
    },
  )
  match.push(or)

  const notes = await File.find()
    .and(match)
    .skip(
      Number(req.query.page) * (req.query.limit || 20) -
        (req.query.limit || 20),
    )
    .limit(Number(req.query.limit))
  const count = await File.countDocuments(match).or(or)

  if (count === 0) {
    if (!req.query.search) {
      req.flash('Error', '창작마당에 레벨이 없습니다.')
      return res.redirect('/')
    } else {
      req.flash('Error', '검색 결과가 없습니다.')
      return res.redirect('/workshop')
    }
  }

  if (Math.ceil(count / (req.query.limit || 20)) < (req.query.page || 1)) {
    req.flash('Error', '페이지가 잘못되었습니다.')
    return res.redirect('/workshop')
  }
  return res.render('workshop', {
    notes,
    count,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    allowed_tags: setting['SEARCH_TAGS'],
  })
})

app.get('/workshop/note', async (req, res) => {
  /**
   * @type {*}
   */
  const note = await File.findOne({
    name: req.query.name,
    public: true,
    file_type: 'note',
  })
  if (!note) {
    req.flash('Error', '해당 채보는 창작마당에 존재하지 않습니다.')
    return res.redirect('/')
  }

  let token_result
  let note_file = String(
    fs.readFileSync(path.join(setting['SAVE_FILE_PATH'], note.name)),
  )

  if (path.extname(note.name) === '.signedrhythmcraft') {
    token_result = utils.verifyToken(note_file)
    if (token_result.error)
      return res.send(`채보 오류 : ${token_result.message}`)
  } else {
    note_file = JSON.parse(note_file)
  }

  /**
   * @type {any}
   */
  const creator = await User.findOne({ fullID: note.owner })
  let badge
  if (creator.equip['image_badge'] != null)
    badge = await Item.findOne({ product_id: creator.equip['image_badge'] })
  const comments = await Comment.find({ note_name: note.name }).sort(
    '-pin -like',
  )

  for (let i of comments) {
    i['user'] = await User.findOne({ fullID: i['writer'] })

    /**
     * @type {*}
     */
    let profile_image = await File.findOne({
      owner: i['writer'],
      file_type: 'avatar',
    })
    if (!profile_image) profile_image = '/img/no_avatar.png'
    else profile_image = `/avatar/${profile_image.name}`

    i['avatar'] = profile_image

    i['pinuser'] = await User.findOne({
      fullID: i['pin_by'],
    })
    i['heartuser'] = await User.findOne({
      fullID: i['heart_by'],
    })
    /**
     * @type {*}
     */
    let heart_user_profile_image = await File.findOne({
      owner: i['heart_by'],
      file_type: 'avatar',
    })
    if (!heart_user_profile_image)
      heart_user_profile_image = '/img/no_avatar.png'
    else heart_user_profile_image = `/avatar/${heart_user_profile_image.name}`

    i['heart_avatar'] = heart_user_profile_image

    if (req.isAuthenticated())
      i['like'] = await Like.findOne({
        user: req.user.fullID,
        comment_id: i['id'],
      })
    else i['like'] = false

    i['like_count'] = await Like.countDocuments({
      comment_id: i['id'],
    })
    i['delete_count'] = await RemoveCommentVote.countDocuments({
      comment_id: i['id'],
    })
  }

  return res.render('workshop_note', {
    note,
    note_file: token_result || note_file,
    creator,
    User,
    File,
    comments,
    comment_delete_required_count: setting.COMMENT_DELETE_REQUIRED_COUNT,
    badge: badge != null ? badge.image_name : null,
  })
})

app.post('/workshop/note/comment', utils.isLogin, async (req, res) => {
  const note = await File.findOne({ name: req.body.name })
  if (!note) {
    req.flash('Error', '해당 채보는 창작마당에 존재하지 않습니다.')
    return res.redirect(`/workshop`)
  }

  if (
    /^(\s|\u0009-\u000d|\u0020|\u0085|\u00a0|\u1680|\u180e|\u2000-\u200d|\u2028-\u2029|\u202f|\u205f-\u2060|\u3000|\ufeff)*$/.test(
      req.body.text,
    )
  ) {
    req.flash('Error', '내용이 없습니다.')
    return res.redirect(`/workshop/note?name=${req.body.name}`)
  }

  await Comment.create({
    writer: req.user.fullID,
    note_name: req.body.name,
    text: req.body.text,
    id: uniqueString(),
    createdAt: Date.now(),
  })

  req.flash('Info', '댓글이 달렸습니다.')
  return res.redirect(`/workshop/note?name=${req.body.name}`)
})

app.get('/workshop/note/removecomment', utils.isLogin, async (req, res) => {
  /**
   * @type {*}
   */
  const comment = await Comment.findOne({ id: req.query.comment })
  if (!comment) {
    req.flash('Error', '해당 댓글이 존재하지 않습니다.')
    return res.redirect(`/workshop`)
  }

  /**
   * @type {*}
   */
  const note = await File.findOne({
    name: comment.note_name,
    file_type: 'note',
  })

  if (
    !req.user.admin &&
    note.owner !== req.user.fullID &&
    comment.writer !== req.user.fullID
  ) {
    req.flash('Error', '권한이 없습니다.')
    return res.redirect(`/workshop/note?name=${comment.note_name}`)
  }

  if (note.owner === req.user.fullID || comment.writer === req.user.fullID) {
    await Comment.deleteOne({ id: req.query.comment })
    await RemoveCommentVote.deleteMany({ comment_id: req.query.comment })

    req.flash('Info', '댓글을 삭제했습니다.')
    return res.redirect(`/workshop/note?name=${comment.note_name}`)
  }
  if (req.user.admin) {
    const delete_count = await RemoveCommentVote.countDocuments({
      comment_id: comment.id,
    })
    const check = await RemoveCommentVote.findOne({
      comment_id: comment.id,
      user: req.user.fullID,
    })

    if (delete_count + 1 >= setting.COMMENT_DELETE_REQUIRED_COUNT && !check) {
      await Comment.deleteOne({ id: req.query.comment })
      await RemoveCommentVote.deleteMany({ comment_id: req.query.comment })

      req.flash('Info', '댓글을 삭제했습니다.')
      return res.redirect(`/workshop/note?name=${comment.note_name}`)
    } else {
      if (check != null) {
        req.flash('Error', '이미 투표했습니다.')
        return res.redirect(`/workshop/note?name=${comment.note_name}`)
      }

      await RemoveCommentVote.create({
        user: req.user.fullID,
        comment_id: comment.id,
      })

      req.flash(
        'Info',
        `댓글 삭제 투표를 했습니다. ${
          setting.COMMENT_DELETE_REQUIRED_COUNT - (delete_count + 1)
        }명의 승인이 추가로 필요합니다.`,
      )
      return res.redirect(`/workshop/note?name=${comment.note_name}`)
    }
  }
})

app.get('/workshop/note/pincomment', utils.isLogin, async (req, res) => {
  /**
   * @type {*}
   */
  const comment = await Comment.findOne({ id: req.query.comment })
  if (!comment) {
    req.flash('Error', '해당 댓글이 존재하지 않습니다.')
    return res.redirect(`/workshop`)
  }

  /**
   * @type {*}
   */
  const note = await File.findOne({
    name: comment.note_name,
    file_type: 'note',
  })

  if (!req.user.admin && note.owner !== req.user.fullID) {
    req.flash('Error', '권한이 없습니다.')
    return res.redirect(`/workshop/note?name=${comment.note_name}`)
  }

  await Comment.updateMany(
    { note_name: note.name },
    { pin: 0, pin_by: 'nobody' },
  )
  await Comment.updateOne(
    { id: req.query.comment },
    { pin: 1, pin_by: req.user.fullID },
  )

  req.flash('Info', '댓글을 고정했습니다.')
  return res.redirect(`/workshop/note?name=${comment.note_name}`)
})

app.get('/workshop/note/unpincomment', utils.isLogin, async (req, res) => {
  /**
   * @type {*}
   */
  const comment = await Comment.findOne({ id: req.query.comment })
  if (!comment) {
    req.flash('Error', '해당 댓글이 존재하지 않습니다.')
    return res.redirect(`/workshop`)
  }

  /**
   * @type {*}
   */
  const note = await File.findOne({
    name: comment.note_name,
    file_type: 'note',
  })

  if (!req.user.admin && note.owner !== req.user.fullID) {
    req.flash('Error', '권한이 없습니다.')
    return res.redirect(`/workshop/note?name=${comment.note_name}`)
  }

  await Comment.updateOne(
    { id: req.query.comment },
    { pin: 0, pin_by: 'nobody' },
  )

  req.flash('Info', '댓글을 고정 해제했습니다.')
  return res.redirect(`/workshop/note?name=${comment.note_name}`)
})

app.post('/workshop/note/likecomment', async (req, res) => {
  if (!req.isAuthenticated())
    return res.send('로그인 후 좋아요를 누를 수 있습니다.')
  /**
   * @type {*}
   */
  const comment = await Comment.findOne({ id: req.query.id })
  if (!comment) return res.send('해당 댓글이 존재하지 않습니다.')

  let liked = await Like.findOne({
    user: req.user.fullID,
    comment_id: comment.id,
  })
  liked = !!liked

  if (!liked)
    await Like.create({
      user: req.user.fullID,
      comment_id: comment.id,
    })
  else await Like.deleteOne({ user: req.user.fullID, comment_id: comment.id })

  const like_count = await Like.countDocuments({ comment_id: comment.id })
  await Comment.updateOne({ id: req.query.id }, { like: like_count })

  if (liked) return res.send('unliked')
  else res.send('liked')
})

app.post('/workshop/note/heartcomment', async (req, res) => {
  if (!req.isAuthenticated())
    return res.json({ message: '로그인을 해 주세요.' })
  /**
   * @type {*}
   */
  const comment = await Comment.findOne({ id: req.query.id })
  if (!comment) return res.json({ message: '해당 댓글이 존재하지 않습니다.' })

  /**
   * @type {*}
   */
  const note = await File.findOne({ name: comment.note_name })
  if (!note) return res.json({ message: '댓글 데이터가 잘못되었습니다.' })

  if (!req.user.admin && req.user.fullID !== note.owner)
    return res.json({ result: 'nopermission' })

  if (comment.heart) {
    await Comment.updateOne(
      { id: comment.id },
      { heart: false, heart_by: 'nobody' },
    )
    return res.json({ result: 'unhearted' })
  } else {
    await Comment.updateOne(
      { id: comment.id },
      { heart: true, heart_by: req.user.fullID },
    )

    /**
     * @type {*}
     */
    let avatar = await File.findOne({
      owner: req.user.fullID,
      file_type: 'avatar',
    })
    if (!avatar) avatar = '/img/no_avatar.png'
    else avatar = `/avatar/${avatar.name}`

    return res.json({ result: 'hearted', avatar })
  }
})

app.get(
  '/workshop/note/cancelallvotecomment',
  utils.isLogin,
  async (req, res) => {
    /**
     * @type {*}
     */
    const comment = await Comment.findOne({ id: req.query.comment })
    if (!comment) {
      req.flash('Error', '해당 댓글이 존재하지 않습니다.')
      return res.redirect(`/workshop`)
    }
    if (!req.user.admin) {
      req.flash('Error', '권한이 없습니다.')
      return res.redirect(`/workshop/note?name=${comment.note_name}`)
    }

    await RemoveCommentVote.deleteMany({ comment_id: comment.id })
    req.flash('Info', '이 댓글의 모든 삭제 투표를 제거했습니다.')
    return res.redirect(`/workshop/note?name=${comment.note_name}`)
  },
)

module.exports = app
