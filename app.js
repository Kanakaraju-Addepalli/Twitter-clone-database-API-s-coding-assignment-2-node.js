const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};
initializeDBAndServer();

// API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUser = `
            SELECT 
                username 
            FROM 
                user 
            WHERE 
                username='${username}';`;
  const dbUser = await db.get(checkUser);
  console.log(dbUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const requestQuery = `
                    INSERT INTO 
                        user(name, username, password, gender) 
                    VALUES
                        ('${name}','${username}','${hashedPassword}','${gender}');`;
      await db.run(requestQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

// API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUser = `
                SELECT 
                    *
                FROM 
                    user 
                WHERE 
                    username='${username}';`;
  const dbUserExist = await db.get(checkUser);
  if (dbUserExist !== undefined) {
    const checkPassword = await bcrypt.compare(password, dbUserExist.password);
    if (checkPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//Authentication JWT Token

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }

  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 3

app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    /** get user id from username  */
    let { username } = request;
    const getUserIdQuery = `
                    SELECT 
                        user_id 
                    FROM 
                        user 
                    WHERE 
                        username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);

    /** get followers ids from user id  */
    const getFollowerIdsQuery = `
                        SELECT 
                            following_user_id 
                        FROM 
                            follower 
                        WHERE 
                            follower_user_id=${getUserId.user_id};`;
    const getFollowerIds = await db.all(getFollowerIdsQuery);
    //get follower ids array
    const getFollowerIdsSimple = getFollowerIds.map((eachUser) => {
      return eachUser.following_user_id;
    });

    const getTweetQuery = `
                    SELECT 
                        user.username, 
                        tweet.tweet, 
                        tweet.date_time as dateTime 
                    FROM 
                        user INNER JOIN tweet ON user.user_id= tweet.user_id 
                    WHERE 
                        user.user_id in (${getFollowerIdsSimple})
                    ORDER BY 
                        tweet.date_time DESC 
                    LIMIT 4 ;`;
    const responseResult = await db.all(getTweetQuery);
    //console.log(responseResult);
    response.send(responseResult);
  }
);

// API 4

app.get("/user/following/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
                SELECT 
                    user_id 
                FROM 
                    user 
                WHERE 
                    username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  // console.log(getUserId);
  const getFollowerIdsQuery = `
                    SELECT 
                        following_user_id 
                    FROM 
                        follower 
                    WHERE 
                        follower_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  //console.log(getFollowerIdsArray);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  //console.log(`${getFollowerIds}`);
  const getFollowersResultQuery = `
                        SELECT 
                            name 
                        FROM 
                            user 
                        WHERE 
                            user_id IN (${getFollowerIds});`;
  const responseResult = await db.all(getFollowersResultQuery);
  //console.log(responseResult);
  response.send(responseResult);
});

// API 5

app.get("/user/followers/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
                    SELECT 
                        user_id 
                    FROM 
                        user 
                    WHERE 
                        username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);
  const getFollowerIdsQuery = `
                    SELECT 
                        follower_user_id 
                    FROM 
                        follower 
                    WHERE 
                        following_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  console.log(getFollowerIdsArray);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(`${getFollowerIds}`);
  //get tweet id of user following x made
  const getFollowersNameQuery = `
                    SELECT 
                        name 
                    FROM 
                        user 
                    WHERE 
                        user_id in (${getFollowerIds});`;
  const getFollowersName = await db.all(getFollowersNameQuery);
  //console.log(getFollowersName);
  response.send(getFollowersName);
});

// API 6
const api6Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const { tweetId } = request.params;
  //console.log(tweetId);
  let { username } = request;
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);

  //get the ids of whom the use is following
  const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);

  const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
    return eachFollower.following_user_id;
  });

  //get the tweets made by the users he is following
  const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id IN (${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });

  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `SELECT count(user_id) AS likes FROM like WHERE tweet_id=${tweetId};`;
    const likes_count = await db.get(likes_count_query);

    const reply_count_query = `SELECT count(user_id) AS replies FROM reply WHERE tweet_id=${tweetId};`;
    const reply_count = await db.get(reply_count_query);

    const tweet_tweetDateQuery = `SELECT tweet, date_time FROM tweet WHERE tweet_id=${tweetId};`;
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);

    response.send(api6Output(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

// API 7

const convertLikedUserNameDBObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/likes/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;

    let { username } = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);

    //get the ids of whom thw use is following
    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);

    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    //check is the tweet ( using tweet id) made by his followers
    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUsersNameQuery = `SELECT user.username AS likes FROM user INNER JOIN like
       ON user.user_id=like.user_id WHERE like.tweet_id=${tweetId};`;
      const getLikedUserNamesArray = await db.all(getLikedUsersNameQuery);

      const getLikedUserNames = getLikedUserNamesArray.map((eachUser) => {
        return eachUser.likes;
      });

      response.send(
        convertLikedUserNameDBObjectToResponseObject(getLikedUserNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// API 8 If the user requests a tweet other than the users he is following
// If the user requests a tweet of a user he is following, return the list of replies.

const convertUserNameReplyedDBObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticationToken,
  async (request, response) => {
    //tweet id of which we need to get reply's
    const { tweetId } = request.params;
    console.log(tweetId);

    //user id from user name

    let { username } = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);

    //get the ids of whom the user is following

    const getFollowingIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);

    //console.log(getFollowingIdsArray);

    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(getFollowingIds);

    //check if the tweet ( using tweet id) made by the person he is  following

    const getTweetIdsQuery = `SELECT tweet_id FROM tweet WHERE user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    console.log(getTweetIds);
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getUsernameReplyTweetsQuery = `SELECT user.name, reply.reply FROM user INNER JOIN reply ON user.user_id=reply.user_id
      WHERE reply.tweet_id=${tweetId};`;
      const getUsernameReplyTweets = await db.all(getUsernameReplyTweetsQuery);

      response.send(
        convertUserNameReplyedDBObjectToResponseObject(getUsernameReplyTweets)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9 Returns a list of all tweets of the user

app.get("/user/tweets/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
                SELECT 
                    user_id 
                FROM 
                    user 
                WHERE 
                    username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId);
  //get tweets made by user
  const getTweetIdsQuery = `
                    SELECT 
                        tweet_id 
                    FROM 
                        tweet 
                    WHERE 
                        user_id=${getUserId.user_id};`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const getTweetIds = getTweetIdsArray.map((eachId) => {
    return parseInt(eachId.tweet_id);
  });
  console.log(getTweetIds);
});

// API 10 Create a tweet in the tweet table

app.post("/user/tweets/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `
                SELECT 
                    user_id 
                FROM 
                    user 
                WHERE 
                    username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const { tweet } = request.body;

  //const currentDate = format(new Date(), "yyyy-MM-dd HH-mm-ss");
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `
                    INSERT INTO 
                        tweet
                            (tweet, user_id, date_time) 
                        VALUES 
                            ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

// API 11

app.delete(
  "/tweets/:tweetId/",
  authenticationToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `
                    SELECT 
                        user_id 
                    FROM 
                        user 
                    WHERE 
                        username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);

    //tweets made by the user
    const getUserTweetsListQuery = `
                        SELECT 
                            tweet_id 
                        FROM 
                            tweet 
                        WHERE 
                            user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);

    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `
                DELETE FROM 
                    tweet 
                WHERE 
                    tweet_id=${tweetId};`;

      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
