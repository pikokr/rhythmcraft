/**
 * Angle calculation provided by PatrickKR
 *
 * Copyright (c) 2020 PatrickKR
 *
 * Do not remove this header.
 */

const utils = require('./utils')

String.prototype.replaceAll = function (org, dest) {
  return this.split(org).join(dest)
}

module.exports = (
  adofai,
  music,
  musicname,
  key_limit,
  fast_input_limit,
  control_note_speed,
  user,
) => {
  adofai = JSON.parse(
    String(adofai)
      .trim()
      .replaceAll(', ,', ',')
      .replaceAll('}\n', '},\n')
      .replaceAll('},\n\t]', '}\n\t]')
      .replaceAll(', },', ' },')
      .replaceAll(', }', ' }')
      .replaceAll('\n', ''),
  )
  const rtnote = {}
  rtnote.music = music
  rtnote.musicname = musicname
  rtnote.author = user.fullID
  rtnote.author_name = adofai.settings.author
  rtnote.note = {}
  rtnote.note.note1 = []
  rtnote.note.note2 = []
  rtnote.note.note3 = []
  rtnote.note.note4 = []
  rtnote.note.note5 = []
  rtnote.note.note6 = []
  rtnote.note.note7 = []
  rtnote.note.note8 = []
  rtnote.jscode = {}

  const roads = adofai.pathData.split('')
  let bpm = adofai.settings.bpm
  let offset = adofai.settings.offset
  let first_spin_timing = (60 / bpm) * 1000
  let note_position = 4
  let before_bpm = bpm
  let bpm_set = false
  let lastms = 0

  /**
   * PatrickKR Start
   */
  let last_tile_angle = 180
  let twirl = false
  let last_note_ms = 0

  const angle_map = {
    L: 0,
    W: 15,
    H: 30,
    Q: 45,
    G: 60,
    q: 75,
    U: 90,
    o: 105,
    T: 120,
    E: 135,
    J: 150,
    p: 165,
    R: 180,
    A: 195,
    M: 210,
    C: 225,
    B: 240,
    Y: 255,
    D: 270,
    V: 285,
    F: 300,
    Z: 315,
    N: 330,
    x: 345,
    '!': undefined,
    5: undefined,
    7: undefined,
  }
  /**
   * PatrickKR End
   */

  for (let i in roads) {
    for (let key in angle_map) {
      if (roads[i] == key) {
        for (let sel in adofai.actions) {
          if (adofai.actions[sel].floor == i) {
            switch (adofai.actions[sel].eventType) {
              case 'SetSpeed':
                before_bpm = bpm
                bpm_set = true
                if (adofai.actions[sel].speedType == 'Multiplier')
                  bpm = bpm * adofai.actions[sel].bpmMultiplier
                else bpm = adofai.actions[sel].beatsPerMinute
                break
              case 'Twirl':
                twirl = !twirl
                break
            }
          }
        }
        /**
         * PatrickKR Start
         */
        if (key == '!') {
          last_tile_angle -= 180
          if (last_tile_angle < 0) {
            last_tile_angle += 360
          }
          continue
        }

        let result
        if (!isNaN(key)) result = 180 - 360 / +key
        else result = 180 - (last_tile_angle - angle_map[key])

        if (twirl) result = 360 - result

        if (result <= 0) result += 360
        if (result > 360) result -= 360

        const ms = (result / 180) * (60 / bpm) * 1000

        if (!isNaN(key))
          last_tile_angle = twirl
            ? last_tile_angle + 360 / +key
            : last_tile_angle - 360 / +key
        else last_tile_angle = angle_map[key]

        let check = last_note_ms - ms
        if (check < 0) check = check * -1
        /**
         * PatrickKR End
         */

        if (result <= 30 || result >= 330) note_position = 8 - note_position + 1
        else if (check <= fast_input_limit)
          note_position = 8 - note_position + 1
        else note_position = utils.getRandomNote(key_limit)

        rtnote['note'][`note${note_position}`].push(
          ms + lastms + offset - first_spin_timing,
        )

        if (control_note_speed && bpm_set)
          rtnote['jscode'][
            Math.floor(lastms + offset - first_spin_timing)
          ] = `note_speed = note_speed / ${bpm / before_bpm}`

        lastms += ms - first_spin_timing
        last_note_ms = ms
        first_spin_timing = 0
        bpm_set = false
      }
    }
  }

  return JSON.stringify(rtnote)
}
