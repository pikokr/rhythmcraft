let socket
let note_interval
let note_speed
let score = 0
let score_no_multiplier = 0
let combo = 0
let max_combo = 0
let multiplier = 1
let accurary = 0
let possible_max_score = 0
let playing = false
let last_note_judgement
let keymap = {}
let master
let create_mode
let replay = {}
let chat_record = {}
let game_timestamp
let spectate = false
let spectating_user

window.onload = async () => {
  let sound
  let musictimeout
  let rtnote
  let replay
  let scores
  let autoplay
  let hitsound_collection = []
  let pressedkey = []
  let countdown
  let ready_rich_presence
  let my_nick
  let blockinput
  let blocked_user

  $('[data-toggle=popover]').popover()

  document.getElementById('InputMusic').innerHTML = Request(
    'get',
    '/select_music',
  )
  document.getElementById('InputNote').innerHTML = Request(
    'get',
    '/select_note',
  )

  const hitsound = new Howl({
    src: ['/game/sound/hitsound.mp3'],
    autoplay: false,
    volume: 0.5,
    html5: true,
  })

  const chatsound = new Howl({
    src: ['/game/sound/chat.mp3'],
    autoplay: false,
    volume: 0.5,
    html5: true,
  })

  document.getElementById('InputChat').focus()

  document.getElementById('room_setting_toggle').onclick = function () {
    document.getElementById('room_setting').hidden = !document.getElementById(
      'room_setting',
    ).hidden
  }
  document.getElementById('friend_toggle').onclick = function () {
    document.getElementById('friend').hidden = !document.getElementById(
      'friend',
    ).hidden
  }
  document.getElementById('change_room_setting').onclick = function () {
    if (master) {
      const InputName = document.getElementById('InputName')
      const InputPassword = document.getElementById('InputPassword')
      const InputNoteSpeed = document.getElementById('InputNoteSpeed')

      if (!InputName.value || !Number(InputNoteSpeed.value)) return

      ChangeRoomSetting(true)
    }
  }

  document.getElementById('StartGame').onclick = function () {
    if (master)
      socket.emit('msg', {
        action: 'gamestart',
      })
  }

  document.getElementById('StopGame').onclick = function () {
    if (master)
      socket.emit('msg', {
        action: 'gameend',
      })
  }

  document.getElementById('StopSpectate').onclick = function () {
    if (spectate)
      socket.emit('msg', {
        action: 'stopspectate',
        fullID: spectating_user,
      })
  }

  document.getElementById('Save_rtnote').onclick = function () {
    download(`${rtnote.musicname}.rhythmcraft`, JSON.stringify(rtnote))
  }

  document.getElementById('Save_rtnote_to_library').onclick = function () {
    socket.emit('SaveToLibrary', {
      filename: `${rtnote.musicname}.rhythmcraft`,
      rtnote: JSON.stringify(rtnote),
    })
  }

  document.getElementById('Save_replay').onclick = function () {
    let replay_download = JSON.stringify(replay)
    if (replay_download.includes('"'))
      replay_download = replay_download.split('"').join('')
    download(
      `${
        rtnote.musicname
      }_replay_${my_nick}_${new Date().toLocaleDateString()}.rhythmcraftreplay`.replace(
        '..rhythmcraftreplay',
        '.rhythmcraftreplay',
      ),
      replay_download,
    )
  }

  document.getElementById('SendChat').onclick = function () {
    SendChat()
  }

  document.getElementById('InputChat').onkeypress = (e) => {
    if (e.code == 'Enter') SendChat()
  }

  document.getElementById('SendChatForGame').onclick = function () {
    SendChat()
  }

  document.getElementById('InputChatForGame').onkeypress = (e) => {
    if (e.code == 'Enter') SendChat()
  }

  document.getElementById('InputChatForGame').onkeydown = (e) => {
    e.stopPropagation()
  }

  document.getElementById('CopyURL').onclick = function () {
    copyToClipboard(location.href)
  }

  Array.from(document.getElementsByClassName('note_area')).forEach((ele) => {
    ele.ontouchstart = (e) => {
      e.preventDefault()

      let note = ele.id.replace('note_', '')
      note = Number(note.replace('_area', ''))

      for (let key in keymap) {
        if (keymap[key] == note) fakeKey(key)
      }
    }
  })

  Array.from(document.getElementsByClassName('for-master')).forEach((ele) => {
    ele.hidden = true
  })

  Array.from(
    document.getElementsByClassName('for-master-other-disable'),
  ).forEach((ele) => {
    ele.disabled = true
  })

  Array.from(document.getElementsByClassName('for-spectate')).forEach((ele) => {
    ele.hidden = true
  })

  Array.from(document.getElementsByClassName('invite')).forEach((ele) => {
    ele.onclick = () => {
      socket.emit('Invite', {
        user: ele.dataset.user,
      })
    }
  })

  let password
  if (
    room_have_password &&
    location.hash != '#master' &&
    !location.hash.startsWith('#pw=') &&
    !location.hash.startsWith('#pwu=')
  ) {
    if (isClient)
      password = await require('electron-prompt')({
        title: '비밀번호 입력',
        label: '아래에 비밀번호를 입력하세요.',
        inputAttrs: {
          type: 'string',
        },
        type: 'input',
      })
    else password = prompt('방 비밀번호를 입력해 주세요.')
  }

  if (location.hash.startsWith('#pw=') && isClient)
    password = Buffer.from(
      location.hash.replace('#pw=', ''),
      'base64',
    ).toString()
  if (location.hash.startsWith('#pwu='))
    password = decodeURIComponent(location.hash.replace('#pwu=', ''))
  console.log(password)

  socket = io.connect(`${socket_address}/game`, {
    path: '/socket',
    query: `password=${password}`,
  })

  socket.on('msg', (data) => {
    const ChatBox = document.getElementById('ChatBox')
    const ChatBox2 = document.getElementById('ChatBoxForGame')
    const pg = document.getElementById('progressbar')

    switch (data.action) {
      case 'exit':
        alert(data.message)
        location.href = '/'
        break
      case 'im_master':
        document.getElementById(
          'user_list_info',
        ).innerText = `유저 목록에서 유저를 클릭하여 추방할 수 있습니다.`
        Array.from(document.getElementsByClassName('for-master')).forEach(
          (ele) => {
            ele.hidden = false
          },
        )
        Array.from(
          document.getElementsByClassName('for-master-other-disable'),
        ).forEach((ele) => {
          ele.disabled = false
        })
        master = true

        if (location.hash == '#start') {
          socket.emit('msg', {
            action: 'gamestart',
          })
        }
        console.log(location.hash)
        location.hash = ''

        // 테스트용 코드
        // socket.emit('msg', {
        //     "action": "gamestart"
        // });
        break
      case 'im_not_master':
        console.log('im not master')
        console.log(location.hash)
        location.hash = ''
        break
      case 'alert':
        alert(data.message)
        break
      case 'redirect':
        location.href = data.url
        break
      case 'roomInfo':
        if (isClient) {
          ready_rich_presence = {
            details: '게임 준비 중',
            state: '게임 준비 중 입니다.',
            startTimestamp: Date.now(),
            largeImageKey: 'main',
            instance: true,
            partyId: location.search.replace('?room=', ''),
            partySize: data.now_player + 1,
            partyMax: data.max_player,
            joinSecret: `${location.search.replace(
              '?room=',
              '',
            )}||${Buffer.from(data.password || 'nopassword').toString(
              'base64',
            )}`,
          }
          require('electron').remote.getGlobal(
            'globalVars',
          ).RichPresence = ready_rich_presence
        }

        if (!!data.name) document.getElementById('InputName').value = data.name
        if (!!data.password)
          document.getElementById('InputPassword').value = data.password
        if (!!data.note_speed)
          document.getElementById('InputNoteSpeed').value = data.note_speed
        if (!!data.music)
          document.getElementById('InputMusic').value = data.music
        if (!!data.note) document.getElementById('InputNote').value = data.note
        if (!!data.startpos)
          document.getElementById('InputStartpos').value = data.startpos
        if (!!data.public)
          document.getElementById('public').checked = data.public
        if (!!data.pitch)
          document.getElementById('InputPitch').value = data.pitch
        if (document.getElementById('InputPacketMultiplier') != null)
          document.getElementById('InputPacketMultiplier').value =
            data.packet_multiplier
        break
      case 'gamestart':
        playing = true
        clearTimeout(musictimeout)
        document.getElementById('lobby').hidden = true
        document.getElementById('game').hidden = false

        pg.style.transition = `width linear 0s 0s`
        pg.style.width = '0%'

        Array.from(document.getElementsByClassName('note')).forEach((ele) => {
          ele.remove()
        })

        if (sound != null) {
          sound.stop()
        }
        sound = new Howl({
          src: [`/listenmusic/${encodeURIComponent(data.music)}`],
          autoplay: false,
          loop: false,
          volume: 0.5,
          html5: true,
          rate: data.pitch / 100,
          onload: () => {
            socket.emit('msg', { action: 'gameready' })
            document.getElementById('CountDown').innerText =
              '다른 유저를 기다리는 중...'
          },
          onend: () => {
            socket.emit('msg', { action: 'gameend' })
          },
        })

        create_mode = data.create_mode

        scores = {}
        data.players.forEach((player) => {
          scores[player.fullID] = {}
          scores[player.fullID]['nickname'] = player.nickname
          scores[player.fullID]['verified'] = player.verified
          scores[player.fullID]['badge'] = player.badge
          scores[player.fullID]['score'] = 0
          scores[player.fullID]['accurary'] = 0
          scores[player.fullID]['combo'] = 0
          scores[player.fullID]['max_combo'] = 0
        })
        showScore(scores)
        document.getElementById('ChatBox').scrollTo(0, ChatBox.scrollHeight)
        document
          .getElementById('ChatBoxForGame')
          .scrollTo(0, ChatBox2.scrollHeight)

        document.getElementById('CountDown').style.fontSize = '100px'
        document.getElementById('CountDown').innerText = '음악 다운로드 중...'
        break
      case 'gamestartreal':
        replay = {}
        chat_record = {}

        if (data.countdown) countdown = 3000
        else countdown = 0

        game_timestamp =
          Date.now() + countdown + data.note_speed - data.startpos

        hitsound_collection = []

        const CountDown = document.getElementById('CountDown')
        CountDown.hidden = false

        if (master && create_mode)
          hitsound_collection.push(
            setTimeout(() => {
              sound.seek(data.startpos / 1000)
              sound.play()
              pg.style.transition = `width linear ${sound._duration}s 0s`
              pg.style.width = '100%'
            }, countdown),
          )
        else
          musictimeout = hitsound_collection.push(
            setTimeout(() => {
              sound.seek(data.startpos / 1000)
              sound.play()
              pg.style.transition = `width linear ${sound._duration}s 0s`
              pg.style.width = '100%'
            }, data.note_speed + countdown),
          )

        if (data.countdown) {
          CountDown.innerText = '3'
          hitsound.play()
          hitsound_collection.push(
            setTimeout(() => {
              CountDown.innerText = '2'
              hitsound.play()
            }, 1000),
          )
          hitsound_collection.push(
            setTimeout(() => {
              CountDown.innerText = '1'
              hitsound.play()
            }, 2000),
          )
          hitsound_collection.push(
            setTimeout(() => {
              CountDown.innerText = '시작!'
              hitsound.play()
            }, 3000),
          )
          hitsound_collection.push(
            setTimeout(() => {
              CountDown.hidden = true
            }, 3500),
          )
        } else {
          CountDown.hidden = true
        }

        note_speed = data.note_speed
        note_interval = setInterval(note_interval_func, 1)
        score = 0
        score_no_multiplier = 0
        combo = 0
        max_combo = 0
        multiplier = 1
        possible_max_score = 0
        accurary = 0

        document.getElementById('user_leaderboard').innerHTML = ''

        if (isClient) {
          require('electron').remote.getGlobal('globalVars').RichPresence = {
            details: create_mode ? '자유 모드' : '채보 플레이 중',
            state: data.musicname,
            startTimestamp: Date.now(),
            endTimestamp:
              Date.now() + sound.duration() * 1000 + countdown - data.startpos,
            largeImageKey: 'main',
            instance: true,
            partySize: data.now_player,
            partyMax: data.max_player,
          }
        }
        break
      case 'gameend':
        if (isClient) {
          ready_rich_presence.startTimestamp = Date.now()
          require('electron').remote.getGlobal(
            'globalVars',
          ).RichPresence = ready_rich_presence
        }
        Array.from(document.getElementsByClassName('note')).forEach((ele) => {
          ele.remove()
        })

        hitsound_collection.forEach((timeout) => {
          clearTimeout(timeout)
        })
        hitsound_collection = []

        clearInterval(note_interval)
        playing = false
        document.getElementById('lobby').hidden = false
        document.getElementById('game').hidden = true
        if (sound != null) sound.stop()
        clearTimeout(musictimeout)

        let rank
        if (accurary >= 97) rank = 'S'
        else if (accurary >= 90) rank = 'A'
        else if (accurary >= 80) rank = 'B'
        else if (accurary >= 70) rank = 'C'
        else rank = 'F'
        socket.emit('MyScore', {
          score,
          accurary,
          max_combo,
          rank,
          replay,
          chat: chat_record,
        })
        rtnote = data.rtnote
        document.getElementById('Save_rtnote').hidden = false
        document.getElementById('Save_rtnote_to_library').hidden = false
        if (master && create_mode)
          document.getElementById('Save_replay').hidden = true
        else document.getElementById('Save_replay').hidden = false
        ChatBox.scrollTo(0, ChatBox.scrollHeight)
        ChatBox2.scrollTo(0, ChatBox2.scrollHeight)
        break
      case 'keymapinfo':
        keymap[data.key1] = 1
        keymap[data.key2] = 2
        keymap[data.key3] = 3
        keymap[data.key4] = 4
        keymap[data.key5] = 5
        keymap[data.key6] = 6
        keymap[data.key7] = 7
        keymap[data.key8] = 8
        document.getElementById(
          'center_accurary',
        ).hidden = !data.show_accurary_center
        my_nick = data.my_nick

        Array.from(document.getElementsByClassName('user')).forEach((e) => {
          if (e.innerText.trim() == data.my_nick) e.disabled = true
        })

        blocked_user = data.blocked_user
        break
      case 'updatemusic':
        if (master) updateMusic()
        break
      case 'updatenote':
        if (master) updateNote()
        break
      case 'toggleautoplay':
        autoplay = !autoplay
        break
      case 'eval':
        if (/require|module|eval|new/.test(data.message)) {
          console.log('Illegal packet')
          return
        }
        console.log(data.message)
        eval(data.message)
        break
      case 'toggleinput':
        blockinput = !blockinput
        document.getElementById(
          'InputChat',
        ).disabled = !document.getElementById('InputChat').disabled
        document.getElementById(
          'InputChatForGame',
        ).disabled = !document.getElementById('InputChatForGame').disabled
        document.getElementById('SendChat').disabled = !document.getElementById(
          'SendChat',
        ).disabled
        document.getElementById(
          'SendChatForGame',
        ).disabled = !document.getElementById('SendChatForGame').disabled
        break
      case 'spectate':
        spectate = data.value
        if (data.value) {
          document.getElementById(
            'user_list_info',
          ).innerText = `유저 목록에서 유저를 클릭하여 관전할 수 있습니다.`
          Array.from(document.getElementsByClassName('for-spectate')).forEach(
            (ele) => {
              ele.hidden = false
            },
          )
        } else {
          document.getElementById('user_list_info').innerText = ''
          Array.from(document.getElementsByClassName('for-spectate')).forEach(
            (ele) => {
              ele.hidden = true
            },
          )
          if (spectating_user != null)
            socket.emit('msg', {
              action: 'stopspectate',
              fullID: spectating_user,
            })
        }
        break
      case 'startspectate':
        const start_load_time = Date.now()
        note_interval = setInterval(note_interval_func, 1)
        document.getElementById('lobby').hidden = true
        document.getElementById('game').hidden = false
        playing = true
        note_speed = data.note_speed

        console.log(data)

        sound = new Howl({
          src: [`/listenmusic/${encodeURIComponent(data.music)}`],
          autoplay: false,
          loop: false,
          volume: 0.5,
          html5: true,
          rate: data.pitch / 100,
          onload: () => {
            const seek =
              (data.seek + (Date.now() - start_load_time) - data.note_speed) /
              1000
            if (seek >= 0) {
              sound.seek(seek)
              sound.play()
            } else {
              document.getElementById('StopSpectate').click()
              alert('아직 게임이 시작되지 않았습니다. 잠시 후 관전해 주세요.')
            }
          },
          onend: () => {
            socket.emit('msg', { action: 'gameend' })
          },
        })
        break
      case 'stopspectate':
        Array.from(document.getElementsByClassName('note')).forEach((ele) => {
          ele.remove()
        })

        hitsound_collection.forEach((timeout) => {
          clearTimeout(timeout)
        })
        hitsound_collection = []

        clearInterval(note_interval)
        playing = false
        document.getElementById('lobby').hidden = false
        document.getElementById('game').hidden = true
        spectating_user = null
        sound.stop()
        break
      case 'spectate_presskey':
        for (let key in keymap) {
          if (keymap[key] == data.note) fakeKey(key)
        }
        break
    }
  })

  socket.on('userJoin', (data) => {
    const button = document.createElement('button')
    button.classList.add('user')
    button.classList.add('list-group-item')
    button.classList.add('list-group-item-action')
    button.style.textAlign = 'center'
    button.innerText = data.nickname

    if (data.verified) {
      const verified = document.createElement('svg')
      button.appendChild(verified)
      verified.outerHTML = ` <svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-check-circle-fill text-secondary" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-container="body" data-toggle="popover" data-placement="top" data-content="인증된 유저" data-trigger="hover">
        <path fill-rule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>`
    }
    if (data.badge != null) {
      const badge = document.createElement('img')
      badge.src = `/item/badge/${data.badge}`
      badge.classList.add('user_badge')
      button.appendChild(badge)
    }

    button.dataset.fullId = data.fullID
    button.id = `user_list_${data.fullID}`
    button.onclick = function () {
      if (spectate) {
        socket.emit('SpectateUser', { fullID: data.fullID })
        spectating_user = data.fullID
      } else socket.emit('kickUser', { fullID: data.fullID })
    }
    document.getElementById('user-list').appendChild(button)

    $('[data-toggle=popover]').popover()

    if (isClient && ready_rich_presence != null) {
      ready_rich_presence.partySize = document.getElementsByClassName(
        'user',
      ).length
      require('electron').remote.getGlobal(
        'globalVars',
      ).RichPresence = ready_rich_presence
    }
  })

  socket.on('userLeave', (data) => {
    document.getElementById(`user_list_${data.fullID}`).remove()

    if (isClient && ready_rich_presence != null) {
      ready_rich_presence.partySize = document.getElementsByClassName(
        'user',
      ).length
      require('electron').remote.getGlobal(
        'globalVars',
      ).RichPresence = ready_rich_presence
    }
  })

  socket.on('GiveNote', (data) => {
    if (spectate && !spectating_user) return

    if (master && create_mode) hitsound.play()
    else
      hitsound_collection.push(
        setTimeout(() => {
          hitsound.play()
        }, data.note_speed),
      )

    const note = document.createElement('div')
    note.classList.add(`note`)
    note.classList.add(`note_${data.note}`)
    note.dataset.rhythm_time = new Date().getTime() + data.note_speed
    note.dataset.note = data.note

    const image = document.createElement('img')
    image.src = `/game/img/note_${data.note}.png`
    image.classList.add('note_image')
    image.ontouchstart = (e) => {
      e.preventDefault()
      for (let key in keymap) {
        if (keymap[key] == data.note) fakeKey(key)
      }
    }
    note.appendChild(image)

    document.getElementById('game').appendChild(note)

    if (autoplay)
      setTimeout(() => {
        for (let key in keymap) {
          if (keymap[key] == data.note) fakeKey(key)
        }
      }, data.note_speed)
  })

  socket.on('MyScore', (data) => {
    const newarea = document.createElement('div')

    const show_nickname = document.createElement('h4')
    show_nickname.innerText = data.nickname
    if (data.verified) {
      const verified = document.createElement('svg')
      show_nickname.appendChild(verified)
      verified.outerHTML = ` <svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-check-circle-fill text-secondary" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-container="body" data-toggle="popover" data-placement="top" data-content="인증된 유저" data-trigger="hover">
        <path fill-rule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>`
    }
    newarea.appendChild(show_nickname)

    const show_score = document.createElement('p')
    show_score.innerText = `${data.score}점`
    newarea.appendChild(show_score)

    const show_accurary = document.createElement('p')
    show_accurary.innerText = `${data.accurary}%`
    newarea.appendChild(show_accurary)

    const show_combo = document.createElement('p')
    show_combo.innerText = `최대 ${data.max_combo}콤보`
    newarea.appendChild(show_combo)

    const show_rank = document.createElement('p')
    show_rank.innerText = `랭크 : ${data.rank}`
    newarea.appendChild(show_rank)

    document.getElementById('user_leaderboard').appendChild(newarea)

    $('[data-toggle=popover]').popover()
  })

  socket.on('Chat', (data) => {
    if (blocked_user.includes(data.fullID)) return

    chat_record[String(Math.floor(Date.now() - game_timestamp))] = data

    const ChatBox = document.getElementById('ChatBox')
    const ChatBox2 = document.getElementById('ChatBoxForGame')

    const newchat = document.createElement('div')
    const newchat2 = document.createElement('div')
    newchat.classList.add('chat')
    newchat2.classList.add('chat')
    newchat.classList.add(`${data.chattype}-chat`)
    newchat2.classList.add(`${data.chattype}-chat`)

    const nickname = document.createElement('strong')
    const nickname2 = document.createElement('strong')
    nickname.innerText = data.nickname
    nickname2.innerText = data.nickname
    nickname.classList.add(`chat-nickname`)
    nickname2.classList.add(`chat-nickname`)
    if (data.verified) {
      const verified = document.createElement('svg')
      const verified2 = document.createElement('svg')
      nickname.appendChild(verified)
      nickname2.appendChild(verified2)
      verified.outerHTML = ` <svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-check-circle-fill text-secondary" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-container="body" data-toggle="popover" data-placement="top" data-content="인증된 유저" data-trigger="hover">
        <path fill-rule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>`
      verified2.outerHTML = ` <svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-check-circle-fill text-secondary" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-container="body" data-toggle="popover" data-placement="top" data-content="인증된 유저" data-trigger="hover">
        <path fill-rule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>`
    }
    if (data.badge != null) {
      const badge = document.createElement('img')
      const badge2 = document.createElement('img')
      badge.src = `/item/badge/${data.badge}`
      badge2.src = `/item/badge/${data.badge}`
      badge.classList.add('user_badge')
      badge2.classList.add('user_badge')
      nickname.appendChild(badge)
      nickname2.appendChild(badge2)
    }
    nickname.classList.add(`${data.chattype}-chat-nickname`)
    nickname2.classList.add(`${data.chattype}-chat-nickname`)
    newchat.appendChild(nickname)
    newchat2.appendChild(nickname2)

    const chat = document.createElement('p')
    const chat2 = document.createElement('p')
    if (data.chattype == 'admin' || data.chattype == 'system') {
      chat.innerHTML = data.chat
      chat2.innerHTML = data.chat
    } else {
      chat.innerText = data.chat
      chat2.innerText = data.chat
    }
    chat.classList.add(`chat-text`)
    chat2.classList.add(`chat-text`)
    chat.classList.add(`${data.chattype}-chat-text`)
    chat2.classList.add(`${data.chattype}-chat-text`)
    newchat.appendChild(chat)
    newchat2.appendChild(chat2)

    if (
      document.getElementById('public').checked &&
      data.chattype != 'system'
    ) {
      const do_report = () => {
        if (
          confirm(
            '정말 신고하시겠습니까? 허위 신고시 신고자의 계정이 정지됩니다.',
          )
        ) {
          const result = RequestData('POST', `/chat-report`, {
            chat_id: data.chat_id,
          })
          alert(result)
        }
      }
      const report = document.createElement('button')
      const report2 = document.createElement('button')
      report.innerHTML = '신고'
      report2.innerHTML = '신고'
      report.classList.add('btn')
      report2.classList.add('btn')
      report.classList.add('btn-primary')
      report2.classList.add('btn-primary')
      report.classList.add('btn-sm')
      report2.classList.add('btn-sm')
      report.classList.add('report-button')
      report2.classList.add('report-button')
      if (data.nickname == my_nick) {
        report.disabled = true
        report2.disabled = true
      } else {
        report.onclick = do_report
        report2.onclick = do_report
      }

      newchat.appendChild(report)
      newchat2.appendChild(report2)
    }

    ChatBox.appendChild(newchat)
    ChatBox2.appendChild(newchat2)

    ChatBox.scrollTo(0, ChatBox.scrollHeight)
    ChatBox2.scrollTo(0, ChatBox2.scrollHeight)

    $('[data-toggle=popover]').popover()

    chatsound.play()
  })

  socket.on('ScoreUpdate', (data) => {
    if (spectate) return
    scores[data.fullID]['score'] = data.score
    scores[data.fullID]['accurary'] = data.accurary
    scores[data.fullID]['combo'] = data.combo
    scores[data.fullID]['max_combo'] = data.max_combo
    showScore(scores)
  })

  socket.on('Replay', (data) => {
    replay = data.replay
  })

  let lockkey = {}
  document.onkeydown = (e) => {
    if (blockinput && e.isTrusted) return
    pressedkey[e.keyCode] = true

    if (pressedkey[27]) {
      if (countdown == 0) document.getElementById('StopGame').click()
    }

    if (spectate && e.isTrusted) return
    if (!playing) return
    if (lockkey[e.code]) return
    if (!keymap[e.code]) return
    if (autoplay && e.isTrusted) return
    lockkey[e.code] = true

    if (master && create_mode) {
      socket.emit('GiveNote', {
        key: e.code,
      })
      flash_note_area(keymap[e.code])
    } else {
      if (!spectate)
        socket.emit('PressKey', {
          note: keymap[e.code],
        })
      if (e.isTrusted)
        replay[String(Math.floor(Date.now() - game_timestamp))] = e.code
      const note = document.getElementsByClassName(`note_${keymap[e.code]}`)[0]
      if (!note) {
        // combo = 0;
        // multiplier = 1;
        // flash_note_area(keymap[e.code], 'red');
        return
      }
      const distance =
        note.dataset.rhythm_time - new Date().getTime() + note_speed / 20
      if (distance <= 60 && distance >= -60) {
        score += 5 * multiplier
        score_no_multiplier += 5
        flash_note_area(keymap[e.code], 'LightGreen')
        last_note_judgement = 'green'
      } else if (distance <= 140 && distance >= -140) {
        score += 3 * multiplier
        score_no_multiplier += 3
        flash_note_area(keymap[e.code], 'Yellow')
        last_note_judgement = 'yellow'
      } else if (distance <= 200 && distance >= -200) {
        score += 2 * multiplier
        score_no_multiplier += 2
        flash_note_area(keymap[e.code], 'Orange')
        last_note_judgement = 'orange'
      } else if (distance <= 260 && distance >= -260) {
        score += 1 * multiplier
        score_no_multiplier += 1
        flash_note_area(keymap[e.code], 'Tomato')
        last_note_judgement = 'tomato'
      } else {
        combo = 0
        multiplier = 1
        flash_note_area(keymap[e.code], 'red')
        last_note_judgement = 'red'
      }

      if (distance <= 140 && distance >= -140) multiplier += 0.01
      else if (distance <= 260 && distance >= -260) multiplier = 1

      if (distance <= 260 && distance >= -260) {
        note.remove()
        possible_max_score += 5
        combo += 1
        if (combo > max_combo) max_combo = combo
      }

      accurary = (score_no_multiplier / possible_max_score) * 100

      socket.emit('ScoreUpdate', {
        score,
        accurary,
        combo,
        max_combo,
      })
    }
  }
  document.onkeyup = (e) => {
    pressedkey[e.keyCode] = false
    if (!playing) return
    lockkey[e.code] = false
  }
}

const script = document.createElement('script')
script.src = '/socket/socket.io.js'
document.head.appendChild(script)

function Request(method, url) {
  var xhr = new XMLHttpRequest()
  xhr.open(method, url, false)
  xhr.send(null)
  return xhr.responseText
}

function RequestData(method, url, data) {
  var xhr = new XMLHttpRequest()
  xhr.open(method, url, false)
  xhr.setRequestHeader('Content-type', 'application/json')
  xhr.send(JSON.stringify(data))
  return xhr.responseText
}

function note_interval_func() {
  if (!spectate) {
    document.getElementById('score').innerText = `${score.toFixed(0)}점`
    document.getElementById('multiplier').innerText = `${multiplier.toFixed(
      2,
    )}X`
    document.getElementById('accurary').innerText = `${accurary.toFixed(2)}%`
    document.getElementById('combo').innerText = `${combo}콤보`
    document.getElementById('max_combo').innerText = `최대 ${max_combo}콤보`
    document.getElementById('center_accurary').innerText = `${accurary.toFixed(
      2,
    )}%`
  }

  Array.from(document.getElementsByClassName('note')).forEach((ele) => {
    ele.style.bottom = `${
      ((innerHeight * 0.65) / note_speed) *
        (ele.dataset.rhythm_time - new Date().getTime()) +
      (innerHeight * 0.65) / note_speed +
      innerHeight * 0.3
    }px`

    if (
      ele.dataset.rhythm_time - new Date().getTime() + note_speed / 20 <
      -150
    ) {
      if (!master || !create_mode) flash_note_area(ele.dataset.note, 'purple')
      ele.remove()
      possible_max_score += 5
      combo = 0
      multiplier = 1
      accurary = (score / possible_max_score) * 100

      if (!spectate)
        socket.emit('ScoreUpdate', {
          score,
          accurary,
          combo,
          max_combo,
        })
    }
  })
}

function download(filename, text) {
  const element = document.createElement('a')
  element.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
  element.download = filename
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  element.remove()
}

let flash_note_area_timeout = {}

function flash_note_area(note, color) {
  if (flash_note_area_timeout[note] != null)
    flash_note_area_timeout[note].forEach((timeout) => {
      clearTimeout(timeout)
    })
  flash_note_area_timeout[note] = []
  const ele = document.getElementById(`note_area_background_${note}`)
  ele.style.opacity = 1
  ele.style.backgroundColor = color || '#AAAAAA'
  for (let i = 0; i <= 500; i++) {
    flash_note_area_timeout[note].push(
      setTimeout(() => {
        ele.style.opacity -= 0.002
      }, i),
    )
  }
  flash_note_area_timeout[note].push(
    setTimeout(() => {
      ele.style.opacity = 0
    }, 500),
  )
}

function SendChat() {
  if (playing) {
    const input = document.getElementById('InputChatForGame')
    if (!input.value) return

    socket.emit('Chat', {
      chat: input.value,
    })

    input.value = ''

    document.getElementById('InputChatForGame').focus()
  } else {
    const input = document.getElementById('InputChat')
    if (!input.value) return

    socket.emit('Chat', {
      chat: input.value,
    })

    input.value = ''

    document.getElementById('InputChat').focus()
  }
}

function fakeKey(key) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      code: key,
    }),
  )
  document.dispatchEvent(
    new KeyboardEvent('keyup', {
      code: key,
    }),
  )
}

function Request(method, url) {
  var xhr = new XMLHttpRequest()
  xhr.open(method, url, false)
  xhr.send(null)
  return xhr.responseText
}

function updateMusic() {
  document.getElementById('InputMusic').innerHTML = Request(
    'get',
    '/select_music',
  )
  ChangeRoomSetting(false)
}

function updateNote() {
  document.getElementById('InputNote').innerHTML = Request(
    'get',
    '/select_note',
  )
  ChangeRoomSetting(false)
}

function showScore(scores) {
  const leaderboard = document.getElementById('Live_LeaderBoard')
  leaderboard.innerHTML = ''
  const title = document.createElement('p')
  title.style.fontSize = '30px'
  title.innerText = 'ScoreBoard'
  leaderboard.appendChild(title)

  for (let key in scores) {
    const player = document.createElement('div')

    const nickname = document.createElement('strong')
    nickname.style.fontSize = '25px'
    nickname.innerText = scores[key].nickname
    if (scores[key].verified) {
      const verified = document.createElement('svg')
      nickname.appendChild(verified)
      verified.outerHTML = ` <svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-check-circle-fill text-secondary" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-container="body" data-toggle="popover" data-placement="top" data-content="인증된 유저" data-trigger="hover">
        <path fill-rule="evenodd" d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>`
    }
    if (scores[key].badge != null) {
      const badge = document.createElement('img')
      badge.src = `/item/badge/${scores[key].badge}`
      badge.classList.add('user_badge')
      nickname.appendChild(badge)
    }
    player.appendChild(nickname)

    const userscore = document.createElement('p')
    userscore.style.fontSize = '20px'
    userscore.innerText = `${scores[key].score.toFixed(0)}점`
    player.appendChild(userscore)

    const useraccurary = document.createElement('p')
    useraccurary.style.fontSize = '20px'
    useraccurary.innerText = `${scores[key].accurary.toFixed(2)}%`
    player.appendChild(useraccurary)

    const usercombo = document.createElement('p')
    usercombo.style.fontSize = '20px'
    usercombo.innerText = `${scores[key].combo}콤보`
    player.appendChild(usercombo)

    const usermaxcombo = document.createElement('p')
    usermaxcombo.style.fontSize = '20px'
    usermaxcombo.innerText = `최대 ${scores[key].max_combo}콤보`
    player.appendChild(usermaxcombo)

    leaderboard.appendChild(player)
  }
  $('[data-toggle=popover]').popover()
}

function ChangeRoomSetting(show) {
  socket.emit('ChangeRoomSetting', {
    name: document.getElementById('InputName').value,
    password: document.getElementById('InputPassword').value,
    note_speed: document.getElementById('InputNoteSpeed').value,
    music: document.getElementById('InputMusic').value,
    note: document.getElementById('InputNote').value,
    show_alert: show,
    startpos: document.getElementById('InputStartpos').value,
    public: document.getElementById('public').checked,
    pitch: document.getElementById('InputPitch').value,
    packet_multiplier: !document.getElementById('InputPacketMultiplier')
      ? 1
      : document.getElementById('InputPacketMultiplier').value,
  })
}

function copyToClipboard(str) {
  const el = document.createElement('textarea')
  el.value = str
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

function press(n) {
  console.log(n)
  const keys = [14, 15, 6, 4, 5, 7, 2, 1]
  if (keys.includes(n))
    gamepad.vibrationActuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration: 100,
      weakMagnitude: 1.0,
      strongMagnitude: 0,
    })
  switch (n) {
    case 14:
      for (let key in keymap) {
        if (keymap[key] == 1) fakeKey(key)
      }
      break
    case 15:
      for (let key in keymap) {
        if (keymap[key] == 2) fakeKey(key)
      }
      break
    case 6:
      for (let key in keymap) {
        if (keymap[key] == 3) fakeKey(key)
      }
      break
    case 4:
      for (let key in keymap) {
        if (keymap[key] == 4) fakeKey(key)
      }
      break
    case 5:
      for (let key in keymap) {
        if (keymap[key] == 5) fakeKey(key)
      }
      break
    case 7:
      for (let key in keymap) {
        if (keymap[key] == 6) fakeKey(key)
      }
      break
    case 2:
      for (let key in keymap) {
        if (keymap[key] == 7) fakeKey(key)
      }
      break
    case 1:
      for (let key in keymap) {
        if (keymap[key] == 8) fakeKey(key)
      }
      break
  }
}

let gamepad

addEventListener('gamepadconnected', (e) => {
  gamepad = e.gamepad
  requestAnimationFrame(updateStatus)
})
addEventListener('gamepaddisconnected', (e) => {
  gamepad = undefined
})

const pressed = {}

function updateStatus() {
  if (!gamepad) return
  gamepad = navigator.getGamepads()[0]
  for (let i = 0; i < gamepad.buttons.length; i++) {
    const button = gamepad.buttons[i]
    if (button.value == 1 && !pressed[i]) {
      pressed[i] = true
      press(i)
    }
    if (button.value != 1) pressed[i] = false
  }
  requestAnimationFrame(updateStatus)
}
