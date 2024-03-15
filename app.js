const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const path = require('path')
const app = express()
app.use(express.json())

const filepath = path.join(__dirname, 'twitterClone.db')
let db = null

const startserver = async () => {
  try {
    db = await open({
      filename: filepath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server starting on http://localhost:3000/')
    })
  } catch (e) {
    console.log(`Db Error ${e.message}`)
    process.exit(1)
  }
}
startserver()

//add user
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const verifyquery = `select * from user where username = '${username}'`
  const data = await db.get(verifyquery)
  if (data !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashpassword = await bcrypt.hash(password, 10)
      const query = `INSERT INTO user(username,password,name,gender)
      VALUES('${username}',${hashpassword},'${name}','${gender}')`
      const dbresponse = await db.run(query)
      response.send('User created successfully')
    }
  }
})

//login user
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const verifyquery = `select * from user where username = '${username}'`
  const data = await db.get(verifyquery)
  if (data === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const checkpassword = await bcrypt.compare(password, data.password)
    if (checkpassword !== true) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {
        username: username,
      }
      const token = jwt.sign(payload, 'Hi rahul')
      response.send({jwtToken: token})
    }
  }
})

//checktokenisvalid
const checktoken = (request, response, next) => {
  let tokenvalue
  const authheader = request.headers['authorization']
  if (authheader === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  }
  if (authheader !== undefined) {
    tokenvalue = authheader.split(' ')[1]
    if (tokenvalue === undefined) {
      response.status(401)
      response.send('Invalid JWT Token')
    } else {
      jwt.verify(tokenvalue, 'Hi rahul', async (error, payload) => {
        if (error) {
          response.status(401)
          response.send('Invalid JWT Token')
        } else {
          request.username = payload.username
          next()
        }
      })
    }
  }
}
//3
app.get('/user/tweets/feed/', checktoken, async (request, response) => {
  let {username} = request
  const userquery = `select user_id from user where username = '${username}'`
  const useridresponse = await db.get(userquery)
  const {user_id} = useridresponse
  const followersquery = `select * from (user Inner join follower on user.user_id = follower.following_user_id) as T Inner join tweet on T.user_id = tweet.user_id where follower_user_id = ${user_id} order by date_time Desc; limit 4`
  const dbresponse = await db.all(followersquery)
  const responseobj = dbresponse.map(each => {
    return {
      username: each.username,
      tweet: each.tweet,
      dateTime: each.date_time,
    }
  })
  response.send(responseobj)
})

//4
app.get('/user/following/', checktoken, async (request, response) => {
  const {username} = request
  const userquery = `select user_id from user where username = '${username}'`
  const useridresponse = await db.get(userquery)
  const query = `select name from user Inner join follower on user.user_id = follower.following_user_id where follower_user_id = ${useridresponse.user_id}`
  const dbresponse = await db.all(query)
  response.send(dbresponse)
})

//5
app.get('/user/followers/', checktoken, async (request, response) => {
  const {username} = request
  const userquery = `select user_id from user where username = '${username}'`
  const useridresponse = await db.get(userquery)
  const query = `select name from user Inner join follower on user.user_id = follower.follower_user_id where following_user_id = ${useridresponse.user_id}`
  const dbresponse = await db.all(query)
  response.send(dbresponse)
})
//tweetcheck
const tweetusers = async (request, response, next) => {
  const {username} = request
  const {tweetId} = request.params
  const userquery = `select user_id from user where username = '${username}'`
  const useridresponse = await db.get(userquery)
  const query = `select following_user_id as user_id from follower where follower_user_id = ${useridresponse.user_id}`
  const dbresponse = await db.all(query)
  const tweetquery = `select * from tweet where tweet_id = ${tweetId}`
  const tweetuserid = await db.get(tweetquery)
  console.log(tweetuserid)
  let istrue = false
  const val = dbresponse.map(each => {
    console.log(each.user_id)
    if (each.user_id === tweetuserid.user_id) {
      istrue = true
    }
  })
  if (istrue === false) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    request.user_id = tweetuserid.user_id
    next()
  }
}

//6
app.get(
  '/tweets/:tweetId/',
  checktoken,
  tweetusers,
  async (request, response) => {
    const {user_id} = request
    const query = `select * from (tweet Inner join reply on tweet.tweet_id = reply.tweet_id) as T Inner join like on T.tweet_id = like.tweet_id where user_id = ${user_id} `
    const dbresponse = await db.all(query)
    console.log(dbresponse)
  },
)

//7

//8

//9
app.get('/user/tweets/', checktoken, async (request, response) => {
  const {username} = request
  const userquery = `select user_id from user where username = '${username}'`
  const useridresponse = await db.get(userquery)
  const query = `select tweet from tweet where tweet.user_id = ${useridresponse.user_id} `
  const dbresponse = await db.all(query)
  response.send(dbresponse)
})
//10
app.post('/user/tweets/', checktoken, async (request, response) => {
  const {username} = request
  const {tweet} = request.body
  const userquery = `select user_id from user where username = '${username}'`
  const useridresponse = await db.get(userquery)
  const query = `INSERT INTO tweet(user_id,tweet) 
  Values(${useridresponse.user_id},'${tweet}')`
  const dbresponse = await db.run(query)
  response.send('Created a Tweet')
})
//useridentify
const findtweet = async (request, response, next) => {
  const {username} = request
  const {tweetId} = request.params
  const userquery = `select user_id from user where username = '${username}'`
  const useridresponse = await db.get(userquery)
  const tweetquery = `select tweet_id from tweet where user_id = ${useridresponse.user_id}`
  const tweetqueryresponse = await db.all(tweetquery)
  let istrue = false
  const val = tweetqueryresponse.map(each => {
    if (each.tweet_id === tweetId.tweet_id) {
      istrue = true
    }
  })
  if (istrue === false) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}
//11
app.delete(
  '/tweets/:tweetId/',
  checktoken,
  findtweet,
  async (request, response) => {
    const {tweetId} = request.params
    const query = `Delete from tweet where tweet_id = ${tweetId}`
    await db.run(query)
    response.send('Tweet Removed')
  },
)
module.exports = app
