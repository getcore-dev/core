if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const sql = require("mssql");
const crypto = require("crypto");
const port = process.env.PORT || 8080;

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  server: process.env.DB_SERVER,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

sql
  .connect(dbConfig)
  .catch((err) => console.error("Error connecting to the database:", err));

const findByUsername = async (username) => {
  try {
    const result =
      await sql.query`SELECT * FROM users WHERE username = ${username}`;
    return result.recordset[0];
  } catch (err) {
    console.error("Database query error:", err);
  }
};

const findById = async (id) => {
  try {
    const result = await sql.query`SELECT * FROM users WHERE id = ${id}`;
    return result.recordset[0];
  } catch (err) {
    console.error("Database query error:", err);
  }
};

const initializePassport = require("./config/passport-config").initialize;
initializePassport(passport, findByUsername, findById, findByUsername);

app.set("view-engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

function checkAuthenticated(req, res, next) {
  try {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/login");
  } catch (error) {
    next(error);
  }
}

function checkNotAuthenticated(req, res, next) {
  try {
    if (req.isAuthenticated()) {
      return res.redirect("/");
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Node.js server-side code
app.get("/api/getUsername/:id", async (req, res) => {
  const id = req.params.id;
  // Fetch the username from your database using the id
  // This is just a placeholder, replace it with your actual database query
  const user = await db.users.find((user) => user.id === id);
  if (user) {
    res.json(user.name);
  } else {
    res.status(404).send("User not found");
  }
});

app.get("/", checkAuthenticated, async (req, res) => {
  try {
    // Fetch posts from the database
    const result = await sql.query("SELECT * FROM posts WHERE deleted = 0");
    let posts = result.recordset;

    // Fetch the user for each post
    for (let post of posts) {
      const userResult = await sql.query(
        `SELECT username FROM users WHERE id = ${post.user_id}`
      );
      const user = userResult.recordset[0];
      post.username = user.username;
    }

    // Render the communities.ejs template with both user and posts data
    res.render("communities.ejs", { user: req.user, posts: posts });
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).send("Error fetching posts");
  }
});

app.get("/jobs", checkAuthenticated, (req, res) => {
  res.render("jobs.ejs", { user: req.user });
});

app.get("/post/create", checkAuthenticated, (req, res) => {
  res.render("create-post.ejs", { user: req.user });
});

app.get("/login", checkNotAuthenticated, async (req, res) => {
  res.render("login.ejs", { user: req.user });
});

app.get("/post", async (req, res) => {
  res.render("post.ejs", { user: req.user });
});

app.get("/register", checkNotAuthenticated, async (req, res) => {
  res.render("register.ejs", { user: req.user });
});

app.get("/learning", checkAuthenticated, async (req, res) => {
  res.render("learning.ejs", { user: req.user });
});

// posts routes
app.get("/posts", async (req, res) => {
  try {
    const result = await sql.query("SELECT * FROM posts WHERE deleted = 0");
    res.json(result.recordset);
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).send("Error fetching posts");
  }
});

const getUserDetails = async (userId) => {
  try {
    const userResult =
      await sql.query`SELECT username FROM users WHERE id = ${userId}`;
    if (userResult.recordset.length > 0) {
      return userResult.recordset[0];
    } else {
      // Throw an error if the user is not found
      throw new Error(`User with ID ${userId} not found`);
    }
  } catch (err) {
    console.error("Database query error:", err);
    // Throw the error to the caller
    throw err;
  }
};

app.get("/posts/:postId", async (req, res) => {
  try {
    const postId = req.params.postId;

    // Fetch all comments related to the post
    const query = `
      SELECT c.id, c.parent_comment_id, c.user_id, c.comment, c.created_at
      FROM comments c
      WHERE c.post_id = '${postId}' AND c.deleted = 0`;

    const result = await sql.query(query);

    // Function to nest comments
    async function nestComments(commentList) {
      const commentMap = {};

      // Create a map of comments
      commentList.forEach((comment) => {
        commentMap[comment.id] = { ...comment, replies: [] };
      });

      const nestedComments = [];
      for (let comment of commentList) {
        if (
          comment.parent_comment_id &&
          commentMap[comment.parent_comment_id]
        ) {
          commentMap[comment.parent_comment_id].replies.push(
            commentMap[comment.id]
          );
        } else {
          nestedComments.push(commentMap[comment.id]);
        }
      }

      // Fetch user details for each comment
      for (let comment of nestedComments) {
        comment.user = await getUserDetails(comment.user_id);
        for (let reply of comment.replies) {
          reply.user = await getUserDetails(reply.user_id);
        }
      }

      return nestedComments;
    }

    // Nest comments
    const nestedComments = await nestComments(result.recordset);

    async function fetchUserDetailsForComments(comments) {
      for (let comment of comments) {
        comment.user = await getUserDetails(comment.user_id);
        if (comment.replies && comment.replies.length > 0) {
          await fetchUserDetailsForComments(comment.replies);
        }
      }
    }

    await fetchUserDetailsForComments(nestedComments);

    // Fetch post details
    const postQuery = `SELECT * FROM posts WHERE id = '${postId}' AND deleted = 0`;
    const postResult = await sql.query(postQuery);

    // Combine post details with comments
    const postData = {
      ...postResult.recordset[0],
      user: await getUserDetails(postResult.recordset[0].user_id),
      comments: await Promise.all(
        nestedComments.map(async (comment) => {
          const user = await getUserDetails(comment.user_id);
          const replies = await Promise.all(
            comment.replies.map(async (reply) => {
              const replyUser = await getUserDetails(reply.user_id);
              console.log(replyUser);
              return { ...reply };
            })
          );
          return { ...comment, user, replies };
        })
      ),
    };

    res.render("post.ejs", { post: postData, user: req.user });
  } catch (err) {
    console.error("Database query error:", err);
    res.status(500).send("Error fetching post and comments");
  }
});

app.post("/posts/:postId/comments", checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id; // Assuming the user ID is stored in req.user
    const { comment } = req.body;

    // Generate a unique ID for the comment
    const commentId = `${Date.now().toString(36)}-${crypto
      .randomBytes(3)
      .toString("hex")}`;

    await sql.query`INSERT INTO comments (id, post_id, parent_comment_id, user_id, comment) VALUES (${commentId}, ${postId}, NULL, ${userId}, ${comment})`;

    // Redirect to the same page
    res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).send("Error adding comment");
  }
});

app.post(
  "/comments/:commentId/replies",
  checkAuthenticated,
  async (req, res) => {
    try {
      const parentCommentId = req.params.commentId;
      const userId = req.user.id;
      const { comment } = req.body; // Assuming the comment text and user ID are sent in the request body

      // Generate a unique ID for the reply
      const replyId = `${Date.now().toString(36)}-${crypto
        .randomBytes(3)
        .toString("hex")}`;

      await sql.query`INSERT INTO comments (id, post_id, parent_comment_id, user_id, comment) VALUES (${replyId}, (SELECT post_id FROM comments WHERE id = ${parentCommentId}), ${parentCommentId}, ${userId}, ${comment})`;

      // Refresh the page
      res.redirect("back");
    } catch (err) {
      console.error("Database insert error:", err);
      res.status(500).send("Error adding reply");
    }
  }
);

app.post("/posts", async (req, res) => {
  try {
    const { userId, title, content } = req.body;

    const uniqueId = `${Date.now().toString(36)}-${crypto
      .randomBytes(3)
      .toString("hex")}`;

    await sql.query`INSERT INTO posts (id, user_id, title, content) VALUES (${uniqueId}, ${userId}, ${title}, ${content})`;

    res.redirect(`/post/${uniqueId}`);
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).send("Error creating post");
  }
});

app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.get("/profile/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const user = await findByUsername(username);

    if (user) {
      res.render("user_profile.ejs", { user });
    } else {
      res.render("404.ejs", { user });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await sql.connect(dbConfig);
    await sql.query`INSERT INTO users (id, username, email, password, zipcode) VALUES (${Date.now().toString()}, ${
      req.body.username
    }, ${req.body.email}, ${hashedPassword}, ${req.body.zipcode})`;

    res.redirect("/login");
  } catch (error) {
    console.error("Database insert error:", error);
    res.redirect("/register");
  }
});

async function deletePostById(postId) {
  await sql.query`UPDATE posts SET deleted = 1 WHERE id = ${postId}`;
}

async function getPostById(postId) {
  const result =
    await sql.query`SELECT * FROM posts WHERE id = ${postId} AND deleted = 0`;
  return result.recordset[0];
}

app.delete("/post/:postId", checkAuthenticated, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    const post = await getPostById(postId);
    if (post.user_id !== userId) {
      return res.status(403).send("You are not authorized to delete this post");
    }

    await deletePostById(postId);
    res.redirect("/");
  } catch (error) {
    console.error("Database delete error:", error);
    res.status(500).send("Error deleting post");
  }
});

async function getCommentById(commentId) {
  const result =
    await sql.query`SELECT * FROM comments WHERE id = ${commentId} AND deleted = 0`;
  return result.recordset[0];
}

async function deleteCommentById(commentId) {
  await sql.query`UPDATE comments SET deleted = 1 WHERE id = ${commentId}`;
}

app.delete("/comment/:commentId", checkAuthenticated, async (req, res) => {
  const commentId = req.params.commentId;
  const userId = req.user.id;

  try {
    const comment = await getCommentById(commentId);
    if (comment.user_id !== userId) {
      return res
        .status(403)
        .send("You are not authorized to delete this comment");
    }

    await deleteCommentById(commentId);
    res.redirect("back");
  } catch (error) {
    console.error("Database delete error:", error);
    res.status(500).send("Error deleting comment");
  }
});

app.delete("/reply/:replyId", checkAuthenticated, async (req, res) => {
  const replyId = req.params.replyId;
  const userId = req.user.id;

  try {
    const reply = await getReplyById(replyId);
    if (reply.user_id !== userId) {
      return res
        .status(403)
        .send("You are not authorized to delete this reply");
    }

    await deleteReplyById(replyId);
    res.redirect("back");
  } catch (error) {
    console.error("Database delete error:", error);
    res.status(500).send("Error deleting reply");
  }
});

app.delete("/logout", (req, res, next) => {
  req.logOut(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.render("404.ejs", { user: req.user });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
