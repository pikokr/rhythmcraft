const express = require('express')
const multer = require('multer')
const path = require('path')
const uniqueString = require('unique-string')
const streamifier = require('streamifier')
const fs = require('fs')
const fileType = require('file-type')
const bodyParser = require('body-parser')
const jwt = require('jsonwebtoken')
const adofai_note = require('../adofai_converter')
const Url = require('url')

const setting = require('../setting.json')
const utils = require('../utils')

const File = require('../schemas/file')
const Comment = require('../schemas/comment')
const Like = require('../schemas/like')

// app 정의
const app = express.Router()

// bodyParser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

const upload = multer({
  storage: multer.memoryStorage(),
})

app.get('/music', utils.isLogin, async (req, res, next) => {
  const regex = new RegExp(req.query.search || '', 'i')
  const files = await File.find({
    owner: req.user.fullID,
    file_type: 'music',
    originalname: { $regex: regex },
  })
  res.render('manage_music', {
    files,
  })
})

app.post(
  '/uploadmusic',
  utils.isLogin,
  upload.single('file'),
  async (req, res, next) => {
    const filetype = await fileType.fromBuffer(req.file.buffer)
    if (!filetype || !filetype.mime.startsWith('audio/')) {
      req.flash('Error', '음악 파일이 아닙니다.')
      return res.redirect(req.get('referrer'))
    }
    if (req.file.size > 1024 * 1024 * 100) {
      req.flash('Error', '파일이 100MB를 초과합니다.')
      return res.redirect(req.get('referrer'))
    }

    const name = `${uniqueString()}${path.extname(req.file.originalname)}`
    streamifier
      .createReadStream(req.file.buffer)
      .pipe(fs.createWriteStream(path.join(setting.SAVE_FILE_PATH, name)))

    await File.create({
      name,
      originalname: req.file.originalname,
      owner: req.user.fullID,
      file_type: 'music',
    })

    req.flash(
      'Info',
      `파일 ${req.file.originalname}이(가) 성공적으로 업로드되었습니다.`,
    )
    return res.redirect(req.get('referrer'))
  },
)

app.get('/removemusic', utils.isLogin, async (req, res, next) => {
  const file = await File.findOne({
    owner: req.user.fullID,
    name: req.query.name,
    file_type: 'music',
  })
  if (!file) {
    req.flash('Error', '해당 파일이 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }
  fs.unlinkSync(path.join(setting.SAVE_FILE_PATH, file.name))
  await File.deleteOne({
    owner: req.user.fullID,
    name: req.query.name,
    file_type: 'music',
  })

  req.flash('Info', `${file.originalname}을(를) 삭제했습니다.`)
  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatemusic' })
  return res.redirect(req.get('referrer'))
})

app.get('/listenmusic', async (req, res, next) => {
  const pathname = Url.parse(req.get('referrer') || '').pathname
  if (
    !req.get('referrer') ||
    (!pathname.startsWith('/music') && !pathname.startsWith('/game'))
  ) {
    if (req.get('sec-fetch-dest') != 'empty') {
      req.flash('Error', '음악 다이렉트 접속은 제한되어 있습니다.')
      return res.redirect('/')
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="README.txt"')
      return res.send('음악은 다운로드할 수 없습니다!')
    }
  }

  const file = await File.findOne({ name: req.query.name, file_type: 'music' })
  if (!file) {
    req.flash('Error', '해당 파일이 존재하지 않습니다.')
    if (req.isAuthenticated()) return res.redirect(req.get('referrer'))
    else return res.redirect('/')
  }
  if (
    (!req.isAuthenticated() || file.owner != req.user.fullID) &&
    !file.public
  ) {
    req.flash('Error', '권한이 없습니다.')
    return res.redirect(req.get('referrer'))
  }
  return res.sendFile(path.join(setting.SAVE_FILE_PATH, req.query.name))
})

app.get('/listenmusic/:music', async (req, res, next) => {
  const pathname = Url.parse(req.get('referrer') || '').pathname
  if (
    !req.get('referrer') ||
    (!pathname.startsWith('/music') && !pathname.startsWith('/game'))
  ) {
    if (req.get('sec-fetch-dest') != 'empty') {
      req.flash('Error', '음악 다이렉트 접속은 제한되어 있습니다.')
      return res.redirect('/')
    } else {
      res.setHeader('Content-Disposition', 'attachment')
      res.setHeader('filename', 'README.txt')
      return res.send('음악은 다운로드할 수 없습니다!')
    }
  }

  const file = await File.findOne({
    name: req.params.music,
    file_type: 'music',
  })
  if (!file) {
    req.flash('Error', '해당 파일이 존재하지 않습니다.')
    if (req.isAuthenticated()) return res.redirect(req.get('referrer'))
    else return res.redirect('/')
  }
  if (
    (!req.isAuthenticated() || file.owner != req.user.fullID) &&
    !file.public
  ) {
    req.flash('Error', '권한이 없습니다.')
    return res.redirect(req.get('referrer'))
  }
  return res.sendFile(path.join(setting.SAVE_FILE_PATH, req.params.music))
})

app.get('/musicstatus', utils.isLogin, async (req, res, next) => {
  const file = await File.findOne({
    name: req.query.name,
    owner: req.user.fullID,
    file_type: 'music',
  })
  if (!file) {
    req.flash('Error', '해당 파일이 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }

  await File.updateOne(
    { name: req.query.name, owner: req.user.fullID, file_type: 'music' },
    { public: req.query.public == 'true' },
  )
  req.flash('Info', `${file.originalname} 파일 공개 상태가 업데이트되었습니다.`)
  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatemusic' })
  return res.redirect(req.get('referrer'))
})

app.get('/note', utils.isLogin, async (req, res, next) => {
  const regex = new RegExp(req.query.search || '', 'i')
  const files = await File.find().or([
    {
      owner: req.user.fullID,
      file_type: 'note',
      originalname: { $regex: regex },
    },
    {
      owner: req.user.fullID,
      file_type: 'note',
      workshop_title: { $regex: regex },
    },
    {
      owner: req.user.fullID,
      file_type: 'note',
      description: { $regex: regex },
    },
  ])
  if (
    files.length == 0 &&
    (req.query.search != null || req.query.search != '')
  ) {
    req.flash('Error', '검색 결과가 없습니다.')
    return res.redirect('/note')
  }
  if (req.query.lucky_play == 'true')
    return res.redirect(
      `/testnote?note=${encodeURIComponent(
        files[0].name,
      )}&startpos=0&singleplay=true`,
    )
  else
    return res.render('manage_note', {
      files,
      allowed_tags: setting.SEARCH_TAGS,
    })
})

app.post(
  '/uploadnote',
  utils.isLogin,
  upload.single('file'),
  async (req, res, next) => {
    if (
      req.file.mimetype != 'application/octet-stream' ||
      (path.extname(req.file.originalname) != '.rhythmcraft' &&
        path.extname(req.file.originalname) != '.signedrhythmcraft')
    ) {
      req.flash('Error', '채보 파일이 아닙니다.')
      return res.redirect(req.get('referrer'))
    }
    if (req.file.size > 1024 * 1024 * 100) {
      req.flash('Error', '파일이 100MB를 초과합니다.')
      return res.redirect(req.get('referrer'))
    }

    const name = `${uniqueString()}${path.extname(req.file.originalname)}`
    streamifier
      .createReadStream(req.file.buffer)
      .pipe(fs.createWriteStream(path.join(setting.SAVE_FILE_PATH, name)))

    await File.create({
      name,
      originalname: req.file.originalname,
      owner: req.user.fullID,
      file_type: 'note',
      description: '레벨에 대해 말해보세요!',
    })

    req.flash(
      'Info',
      `채보 ${req.file.originalname}이(가) 성공적으로 업로드되었습니다.`,
    )
    req.app
      .get('socket_game')
      .to(`user_${req.user.fullID}`)
      .emit('msg', { action: 'updatenote' })
    return res.redirect(req.get('referrer'))
  },
)

app.get('/downloadnote', utils.isLogin, async (req, res, next) => {
  const file = await File.findOne({
    owner: req.user.fullID,
    name: req.query.name,
    file_type: 'note',
  })
  if (!file) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }
  return res.download(
    path.join(setting.SAVE_FILE_PATH, file.name),
    file.originalname,
  )
})

app.get('/removenote', utils.isLogin, async (req, res, next) => {
  const file = await File.findOne({
    owner: req.user.fullID,
    name: req.query.name,
    file_type: 'note',
  })
  if (!file) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }
  fs.unlinkSync(path.join(setting.SAVE_FILE_PATH, file.name))
  await File.deleteOne({
    owner: req.user.fullID,
    name: req.query.name,
    file_type: 'note',
  })

  const comments = await Comment.find({ note_name: req.query.name })
  comments.forEach(async (comment) => {
    await Like.deleteMany({ comment_id: comment.id })
  })

  await Comment.deleteMany({ note_name: req.query.name })

  req.flash('Info', `${file.originalname}을(를) 삭제했습니다.`)
  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatenote' })
  return res.redirect(req.get('referrer'))
})

app.get('/select_music', utils.isLogin, async (req, res, next) => {
  const files = await File.find({
    owner: req.user.fullID,
    file_type: 'music',
    public: true,
  })
  return res.render('select_music', {
    files,
  })
})

app.get('/select_note', utils.isLogin, async (req, res, next) => {
  const notes = await File.find({ owner: req.user.fullID, file_type: 'note' })
  return res.render('select_note', {
    notes,
  })
})

app.post('/savenote', utils.isLogin, async (req, res, next) => {
  const file = await File.findOne({
    owner: req.user.fullID,
    name: req.body.name,
    file_type: 'note',
  })
  if (!file) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }

  fs.writeFileSync(
    path.join(setting.SAVE_FILE_PATH, file.name),
    JSON.stringify(req.body.note),
  )
  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatenote' })
  return res.send('ok')
})

app.post(
  '/signnote',
  utils.isAdmin,
  upload.single('file'),
  async (req, res, next) => {
    if (
      req.file.mimetype != 'application/octet-stream' ||
      path.extname(req.file.originalname) != '.rhythmcraft'
    ) {
      req.flash('Error', '채보 파일이 아닙니다.')
      return res.redirect(req.get('referrer'))
    }
    if (req.file.size > 1024 * 1024 * 100) {
      req.flash('Error', '파일이 100MB를 초과합니다.')
      return res.redirect('/')
    }

    const name = `${uniqueString()}.signedrhythmcraft`

    const note = JSON.parse(req.file.buffer.toString('utf-8'))
    const token = jwt.sign(note, setting.TOKEN_SECRET, {
      issuer: setting.SERVER_NAME,
    })
    fs.writeFileSync(path.join(setting.SAVE_FILE_PATH, name), token)

    await File.create({
      name,
      originalname: req.file.originalname.replace(
        '.rhythmcraft',
        '.signedrhythmcraft',
      ),
      owner: req.user.fullID,
      file_type: 'note',
      description: '레벨에 대해 말해보세요!',
    })

    req.flash(
      'Info',
      `서명된 채보 ${req.file.originalname}이(가) 성공적으로 업로드되었습니다. <a href="/note">채보 관리 페이지</a>에서 확인하세요.`,
    )
    req.app
      .get('socket_game')
      .to(`user_${req.user.fullID}`)
      .emit('msg', { action: 'updatenote' })
    return res.redirect('/admin/sign')
  },
)

app.get('/signnotetext', utils.isAdmin, async (req, res, next) => {
  const testnote = await File.findOne({
    owner: req.user.fullID,
    file_type: 'note',
    name: req.query.name,
  })
  if (!testnote) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }

  const name = `${uniqueString()}.signedrhythmcraft`

  const note = JSON.parse(
    fs.readFileSync(path.join(setting.SAVE_FILE_PATH, req.query.name)),
  )
  delete note.iss
  delete note.iat
  const token = jwt.sign(note, setting.TOKEN_SECRET, {
    issuer: setting.SERVER_NAME,
  })
  fs.writeFileSync(path.join(setting.SAVE_FILE_PATH, name), token)

  await File.create({
    name,
    originalname: req.query.originalname.replace(
      '.rhythmcraft',
      '.signedrhythmcraft',
    ),
    owner: req.user.fullID,
    file_type: 'note',
    workshop_title: testnote.workshop_title,
    description: testnote.description,
    tags: testnote.tags,
  })

  req.flash(
    'Info',
    `채보 ${req.query.originalname}를 성공적으로 서명하였습니다.`,
  )
  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatenote' })
  return res.redirect(req.get('referrer'))
})

app.get('/unsignnote', utils.isLogin, async (req, res, next) => {
  const testnote = await File.findOne({
    owner: req.user.fullID,
    file_type: 'note',
    name: req.query.name,
  })
  if (!testnote) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }

  if (path.extname(testnote.name) != '.signedrhythmcraft') {
    req.flash('Error', '서명된 채보 파일이 아닙니다.')
    return res.redirect(req.get('referrer'))
  }

  const name = `${uniqueString()}.rhythmcraft`

  const note = String(
    fs.readFileSync(path.join(setting.SAVE_FILE_PATH, req.query.name)),
  )
  const result = utils.verifyToken(note)
  if (result.error) {
    req.flash('Error', `채보 오류 : ${result.message}`)
    return res.redirect(req.get('referrer'))
  }
  fs.writeFileSync(
    path.join(setting.SAVE_FILE_PATH, name),
    JSON.stringify(result),
  )

  await File.create({
    name,
    originalname: req.query.originalname.replace(
      '.signedrhythmcraft',
      '.rhythmcraft',
    ),
    owner: req.user.fullID,
    file_type: 'note',
    workshop_title: testnote.workshop_title,
    description: testnote.description,
    tags: testnote.tags,
  })

  req.flash(
    'Info',
    `채보 ${req.query.originalname}를 성공적으로 서명 해제하였습니다.`,
  )
  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatenote' })
  return res.redirect(req.get('referrer'))
})

app.get('/notestatus', utils.isLogin, async (req, res, next) => {
  const file = await File.findOne({ name: req.query.name, file_type: 'note' })
  if (!file) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }
  if (!req.user.admin && file.owner != req.user.fullID) {
    req.flash('Error', '권한이 없습니다.')
    return res.redirect(req.get('referrer'))
  }

  if (!file.workshop_title) {
    req.flash('Error', '창작마당용 제목을 정해주세요.')
    return res.redirect(req.get('referrer'))
  }

  await File.updateOne(
    { name: req.query.name, file_type: 'note' },
    { public: req.query.public == 'true' },
  )
  req.flash('Info', `${file.originalname} 채보 공개 상태가 업데이트되었습니다.`)
  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatenote' })
  return res.redirect(req.get('referrer'))
})

app.post('/editnoteinfo', utils.isLogin, async (req, res, next) => {
  const checkfile = await File.findOne({
    name: req.body.name,
    owner: req.user.fullID,
    file_type: 'note',
  })
  if (!checkfile) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect(req.get('referrer'))
  }

  let tags
  let savetags = []
  if (req.body.tags != null) {
    if (typeof req.body.tags == 'string') tags = [req.body.tags]
    else tags = req.body.tags

    tags.forEach((tag) => {
      if (setting.SEARCH_TAGS.indexOf(tag) != -1) savetags.push(tag)
    })
  }

  await File.updateOne(
    { name: req.body.name, owner: req.user.fullID, file_type: 'note' },
    {
      workshop_title: req.body.title,
      description: req.body.description,
      tags: savetags.join(','),
    },
  )

  req.flash('Info', `${checkfile.originalname} 채보의 정보가 수정되었습니다.`)
  return res.redirect(req.get('referrer'))
})

app.get('/saveworkshopnote', utils.isLogin, async (req, res, next) => {
  const checkfile = await File.findOne({
    name: req.query.name,
    file_type: 'note',
    public: true,
  })
  if (!checkfile) {
    req.flash('Error', '해당 채보가 존재하지 않습니다.')
    return res.redirect('/workshop')
  }

  const name = `${uniqueString()}${path.extname(req.query.name)}`
  fs.copyFileSync(
    path.join(setting.SAVE_FILE_PATH, req.query.name),
    path.join(setting.SAVE_FILE_PATH, name),
  )
  await File.create({
    name,
    originalname: checkfile.originalname,
    owner: req.user.fullID,
    file_type: 'note',
    description: '레벨에 대해 말해보세요!',
  })

  req.app
    .get('socket_game')
    .to(`user_${req.user.fullID}`)
    .emit('msg', { action: 'updatenote' })

  req.flash('Info', '채보를 나의 노트 보관함에 저장했습니다.')
  return res.redirect(`/workshop/note?name=${req.query.name}`)
})

app.post(
  '/upload_avatar',
  utils.isLogin,
  upload.single('file'),
  async (req, res, next) => {
    const filetype = await fileType.fromBuffer(req.file.buffer)
    if (!filetype || !filetype.mime.startsWith('image/')) {
      req.flash('Error', '이미지 파일이 아닙니다.')
      return res.redirect('/upload_avatar')
    }
    if (req.file.size > 1024 * 1024 * 10) {
      req.flash('Error', '파일이 10MB를 초과합니다.')
      return res.redirect('/')
    }

    const name = `avatar_${req.user.fullID}`
    streamifier
      .createReadStream(req.file.buffer)
      .pipe(fs.createWriteStream(path.join(setting.AVATAR_PATH, name)))

    await File.deleteMany({ owner: req.user.fullID, file_type: 'avatar' })
    await File.create({
      name,
      originalname: req.file.originalname,
      owner: req.user.fullID,
      file_type: 'avatar',
    })

    req.flash(
      'Info',
      `프로필 사진 ${req.file.originalname}이(가) 성공적으로 업로드되었습니다.`,
    )
    return res.redirect('/mypage')
  },
)

app.post(
  '/adofai-converter',
  utils.isLogin,
  upload.fields([{ name: 'music' }, { name: 'adofai' }]),
  async (req, res, next) => {
    let key_limit = req.body.key_limit
    if (typeof key_limit == 'string') key_limit = [key_limit]
    key_limit = key_limit.map((a) => Number(a))

    const nomusicselect = req.body.music_select == 'noselect'

    if (nomusicselect) {
      const music_filetype = await fileType.fromBuffer(
        req.files.music[0].buffer,
      )
      if (!music_filetype || !music_filetype.mime.startsWith('audio/')) {
        req.flash('Error', '음악 파일이 아닙니다.')
        return res.redirect('/adofai-converter')
      }
      if (req.files.music[0].size > 1024 * 1024 * 100) {
        req.flash('Error', '파일이 100MB를 초과합니다.')
        return res.redirect('/adofai-converter')
      }
    }

    if (
      req.files.adofai[0].mimetype != 'application/octet-stream' ||
      path.extname(req.files.adofai[0].originalname) != '.adofai'
    ) {
      req.flash('Error', 'ADOFAI 채보 파일이 아닙니다.')
      return res.redirect('/adofai-converter')
    }
    if (req.files.adofai[0].size > 1024 * 1024 * 100) {
      req.flash('Error', '파일이 100MB를 초과합니다.')
      return res.redirect('/adofai-converter')
    }

    if (isNaN(req.body.fast_input_limit)) {
      req.flash('Error', '연타 인식 제한이 잘못되었습니다.')
      return res.redirect('/adofai-converter')
    }

    if (nomusicselect && !req.files.music[0]) {
      req.flash('Error', '음악이 선택되지 않았습니다.')
      return res.redirect('/adofai-converter')
    }

    const adofai = JSON.parse(
      String(req.files.adofai[0].buffer)
        .trim()
        .replaceAll(', ,', ',')
        .replaceAll('}\n', '},\n')
        .replaceAll('},\n\t]', '}\n\t]')
        .replaceAll(', },', ' },')
        .replaceAll(', }', ' }')
        .replaceAll('\n', ''),
    )
    if (!adofai.pathData || !adofai.settings || !adofai.actions) {
      req.flash('Error', 'ADOFAI 채보 파일이 잘못되었습니다.')
      return res.redirect('/adofai-converter')
    }

    let music
    if (req.body.music_select != null)
      music = await File.findOne({ name: req.body.music_select })

    let music_name
    if (nomusicselect)
      music_name = `${uniqueString()}${path.extname(
        req.files.music[0].originalname,
      )}`
    else music_name = music.name
    const note_name = `${uniqueString()}.signedrhythmcraft`

    const convert_result = adofai_note(
      req.files.adofai[0].buffer,
      music_name,
      !music ? req.files.music[0].originalname : music.originalname,
      key_limit,
      Number(req.body.fast_input_limit),
      req.body.control_note_speed == 'true',
      req.user,
    )

    const token = jwt.sign(JSON.parse(convert_result), setting.TOKEN_SECRET, {
      issuer: setting.SERVER_NAME,
    })

    fs.writeFileSync(path.join(setting.SAVE_FILE_PATH, note_name), token)

    await File.create({
      name: note_name,
      originalname: req.files.adofai[0].originalname.replace(
        '.adofai',
        '.signedrhythmcraft',
      ),
      owner: req.user.fullID,
      file_type: 'note',
      workshop_title: `${adofai.settings.artist || 'Unknown'} - ${
        adofai.settings.song || 'Unknown'
      }`,
      description: '레벨에 대해 말해보세요!',
    })

    if (nomusicselect) {
      streamifier
        .createReadStream(req.files.music[0].buffer)
        .pipe(
          fs.createWriteStream(path.join(setting.SAVE_FILE_PATH, music_name)),
        )

      await File.create({
        name: music_name,
        originalname: req.files.music[0].originalname,
        owner: req.user.fullID,
        file_type: 'music',
        public: true,
      })
    }

    req.flash(
      'Info',
      '변환에 성공하였습니다. <a href="/note">채보 관리 페이지</a>에서 확인하세요.',
    )
    req.app
      .get('socket_game')
      .to(`user_${req.user.fullID}`)
      .emit('msg', { action: 'updatemusic' })
    req.app
      .get('socket_game')
      .to(`user_${req.user.fullID}`)
      .emit('msg', { action: 'updatenote' })
    return res.redirect('/adofai-converter')
  },
)

module.exports = app
