const express = require('express')
const fs = require('fs')

const User = require('../schemas/user')
const Comment = require('../schemas/comment')
const RemoveCommentVote = require('../schemas/remove_comment_vote')
const File = require('../schemas/file')
const Like = require('../schemas/like')
const Chat = require('../schemas/chat')

const utils = require('../utils')
const setting = require('../setting.json')

const app = express.Router()

app.get('/admin', utils.isAdmin, (req, res) => {
  res.render('admin')
})

app.get('/admin/:page', utils.isAdmin, async (req, res) => {
  switch (req.params.page) {
    case 'user':
      if (!req.query.id && !req.query.nickname) res.render('admin-user-menu')
      else {
        let user
        if (!req.query.nickname)
          user = await User.findOne({ fullID: req.query.id })
        else user = await User.findOne({ nickname: req.query.nickname })
        if (user == null) {
          req.flash('Error', '해당 유저를 찾을 수 없습니다.')
          return res.redirect('/admin/user')
        }

        const game_skins = fs
          .readdirSync('./public/skin/game')
          .map((n) => n.replace('.css', ''))

        res.render('admin-user-edit', {
          edituser: user,
          game_skins,
        })
      }
      return
    case 'mail':
      res.render('admin-mail')
      return
    case 'sign':
      res.render('admin-sign')
      return
    case 'manage-comment-vote':
      const comments = await Comment.find({})

      for (let i of comments) {
        i['delete_count'] = await RemoveCommentVote.countDocuments({
          comment_id: i['id'],
        })
        if (i['delete_count'] === 0) {
          i['dontshow'] = true
          continue
        }

        i['user'] = await User.findOne({
          fullID: i['writer'],
        })

        let profile_image = await File.findOne({
          owner: comments[i]['writer'],
          file_type: 'avatar',
        })
        if (!profile_image) profile_image = '/img/no_avatar.png'
        else profile_image = `/avatar/${profile_image.name}`

        comments[i]['avatar'] = profile_image

        comments[i]['pinuser'] = await User.findOne({
          fullID: comments[i]['pin_by'],
        })
        comments[i]['heartuser'] = await User.findOne({
          fullID: comments[i]['heart_by'],
        })
        let heart_user_profile_image = await File.findOne({
          owner: comments[i]['heart_by'],
          file_type: 'avatar',
        })
        if (!heart_user_profile_image)
          heart_user_profile_image = '/img/no_avatar.png'
        else1
        heart_user_profile_image = `/avatar/${heart_user_profile_image.name}`

        comments[i]['heart_avatar'] = heart_user_profile_image

        if (req.isAuthenticated())
          comments[i]['like'] = await Like.findOne({
            user: req.user.fullID,
            comment_id: comments[i]['id'],
          })
        else comments[i]['like'] = false

        comments[i]['like_count'] = await Like.countDocuments({
          comment_id: comments[i]['id'],
        })
      }
      res.render('admin-comment-vote', {
        comments,
        comment_delete_required_count: setting.COMMENT_DELETE_REQUIRED_COUNT,
      })
      return
    case 'chat-report':
      const chats = await Chat.find({ reported: true })
      for (let i of chats) {
        const user = await User.findOne({ fullID: chats[i]['fullID'] })
        i['nickname'] = user.nickname
        i['verified'] = user.verified
      }
      res.render('admin-chat-report', {
        chats,
      })
      return
    case 'create-promotion':
      res.render('admin_promotion')
      return
    case 'notification':
      res.render('admin-notification')
      return
    default:
      req.flash('Error', '해당 관리 페이지가 존재하지 않습니다.')
      res.redirect('/admin')
      return
  }
})

module.exports = app
