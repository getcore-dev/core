const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const postQueries = require('../queries/postQueries');
const utilFunctions = require('../utils/utilFunctions');
const getUserDetails = utilFunctions.getUserDetails;
const { getLinkPreview } = require('../utils/utilFunctions');
const userQueries = require('../queries/userQueries');
const marked = require('marked');
const DOMpurify = require('dompurify');
const rateLimit = require('express-rate-limit');
const PostController = require('../controllers/postController');
const notificationQueries = require('../queries/notificationQueries');
const viewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 2400,
  handler: (req, res, next) => {
    req.rateLimit = {
      exceeded: true,
    };
    next();
  },
  keyGenerator: (req) => `${req.ip}_${req.params.postId}`,
  skip: (req) => {
    const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
    return req.rateLimit.resetTime && req.rateLimit.resetTime < eightHoursAgo;
  },
});


router.get('/posts', async (req, res) => {
  try {
    const posts = await postQueries.getPosts();
    res.render('posts.ejs', { user: req.user, error: null, posts: posts });
  } catch (err) {
    console.error('Database query error:', err);
    const error = { status: 500, message: 'Error fetching posts' };
    res.render('error.ejs', { user: req.user, error });
  }
});

// Route for creating a new post
router.post('/posts', checkAuthenticated, async (req, res) => {
  try {
    const { userId, title, content, link, community_id, tags, post_type } =
      req.body;

    const postId = await postQueries.createPost(
      userId,
      title,
      content,
      link,
      community_id,
      tags || [],
      post_type
    );

    return res.redirect(`/posts/${postId}`);
  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).render('error.ejs', {
      error: { status: 500, message: 'Error creating post' },
    });
  }
});

router.post(
  '/posts/:postId/answer/:commentId',
  checkAuthenticated,
  async (req, res) => {
    try {
      const postId = req.params.postId;
      const commentId = req.params.commentId;
      const userId = req.user.id;

      const result = await postQueries.acceptAnswer(postId, commentId, userId);

      await notificationQueries.createNotification(
        userId,
        result.comment.user_id,
        'ACCEPTED_ANSWER',
        postId);

      if (result) {
        // redirect to the post page
        res.redirect(`/posts/${postId}`);
      }
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).send('Error accepting answer');
    }
  }
);

router.post('/posts/:postId/react', checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const action = req.body.action.toUpperCase();
    const validActions = ['LOVE', 'LIKE', 'CURIOUS', 'DISLIKE'];

    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const result = await postQueries.interactWithPost(postId, userId, action);

    res.json({
      message: 'Post reaction updated successfully',
      userReaction: result.userReaction,
      totalReactions: result.totalReactions,
      reactionsMap: result.reactionsMap,
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Error processing reaction' });
  }
});

router.get('/posts/:postId', viewLimiter, async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = req.user;

    if (req.rateLimit && req.rateLimit.exceeded) {
      return res.render('error.ejs', {
        user: req.user,
        error: { status: 429, message: 'Rate limit exceeded' },
      });
    }

    // Fetch only essential post data
    const postResult = await utilFunctions.getPostData(postId, user);
    const [tags, community, comments, postUser] = await Promise.all([
      utilFunctions.getTags(postId),
      utilFunctions.getCommunityDetails(postResult.communities_id),
      fetchComments(postId, user),
      getUserDetails(postResult.user_id)
    ]);

    // if community.PrivacySetting === 'private' and user.isAdmin is 0 then send them to the home page
    if (community.PrivacySetting === 'private' && !user.isAdmin) {
      return res.redirect('/');
    }

    const postData = {
      ...postResult,
      tags,
      comments,
      user: postUser,
      community
    };

    // Handle special post types
    if (postData.link && postData.post_type === 'project') {
      [postData.gitHubfavicon, postData.gitHubLinkPreview] = await Promise.all([
        utilFunctions.getFavicon(postData.link),
        utilFunctions.getGitHubRepoPreview(postData.link)
      ]);
      postData.gitHubMatchUsername = postData.user.github_url === JSON.parse(postData.gitHubLinkPreview.raw_json).owner.login;
    }

    if (postData.post_type === 'question') {
      postData.solution = await postQueries.getAcceptedAnswer(postId);
      if (postData.solution) {
        postData.solution.user = await getUserDetails(postData.solution.user_id);
      }
    }

    if (postData.link) {
      postData.linkPreview = await getLinkPreview(postData.link);
    }

    // Render content
    if (postData.content && postData.content.length > 0) {
      postData.content = marked.parse(postData.content);
    }

    await postQueries.viewPost(postId);
    res.render('post.ejs', {
      post: postData,
      user: req.user,
      communityId: postData.communities_id,
      community: postData.community,
      similarPosts: await postQueries.fetchSimilarPosts(
        user,
        postId,
        postData.communities_id,
        tags,
        postData.title
      ),
      linkify: utilFunctions.linkify,
    });
  } catch (err) {
    // handle TypeError: Cannot read property 'communities_id' of undefined
    console.error('Database query error:', err);
    res.status(500).render('communities.ejs' , { user: req.user, communityId: null, community: null, errorMessages: ['Error finding that post'], successMessages: [] });


  }
});

router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = req.user;
    const comments = await fetchComments(postId, user);
    res.json(comments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Error fetching comments' });
  }
});

router.get('/posts/:postId/similar', async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = req.user;
    const post = await postQueries.getPostById(postId);
    const similarPosts = await postQueries.fetchSimilarPosts(
      user,
      postId,
      post.communities_id,
      await utilFunctions.getTags(postId),
      post.title
    );
    res.json(similarPosts);
  } catch (err) {
    console.error('Error fetching similar posts:', err);
    res.status(500).json({ error: 'Error fetching similar posts' });
  }
});

async function fetchComments(postId, user) {
  const query = `
WITH CommentCTE AS (
  SELECT
    c.id,
    c.created_at,
    c.deleted,
    c.comment,
    c.user_id,
    c.parent_comment_id,
    c.post_id,
    c.isPinned,
    SUM(CASE WHEN uca.action_type = 'LOVE' THEN 1 ELSE 0 END) AS loveCount,
    SUM(CASE WHEN uca.action_type = 'B' THEN 1 ELSE 0 END) AS boostCount,
    SUM(CASE WHEN uca.action_type = 'DISLIKE' THEN 1 ELSE 0 END) AS dislikeCount,
    SUM(CASE WHEN uca.action_type = 'CURIOUS' THEN 1 ELSE 0 END) AS curiousCount,
    SUM(CASE WHEN uca.action_type = 'LIKE' THEN 1 ELSE 0 END) AS likeCount,
    SUM(CASE WHEN uca.action_type = 'CELEBRATE' THEN 1 ELSE 0 END) AS celebrateCount,
    ${user ? '(SELECT TOP 1 uca2.action_type FROM UserCommentActions uca2 WHERE uca2.comment_id = c.id AND uca2.user_id = @userId) AS userReaction,' : 'NULL AS userReaction,'}
    CASE WHEN EXISTS (SELECT 1 FROM comments child WHERE child.parent_comment_id = c.id) THEN 1 ELSE 0 END AS hasReplies,
    
    -- Include recent Job Experience
    je.title AS experience_title,
    CASE 
      WHEN je.companyName IS NOT NULL THEN 
        CASE 
          WHEN u.settings_PrivateJobNames = 1 THEN 'Company'
          ELSE je.companyName 
        END
      ELSE NULL
    END AS experience_place,
    
    -- Include recent Education Experience
    ee.institutionName AS education_institution,
    CASE 
      WHEN ee.institutionName IS NOT NULL THEN 
        CASE
          WHEN u.settings_PrivateSchoolNames = 1 THEN 'Institution'
          ELSE ee.institutionName
        END
      ELSE NULL
    END AS education_place

  FROM comments c
  LEFT JOIN UserCommentActions uca ON c.id = uca.comment_id
  
  -- Join with users table to access user settings
  INNER JOIN users u ON c.user_id = u.id
  
  -- OUTER APPLY to get the most recent Job Experience
  OUTER APPLY (
    SELECT TOP 1 title, companyName
    FROM job_experiences
    WHERE userId = c.user_id
    ORDER BY startDate DESC
  ) je
  
  -- OUTER APPLY to get the most recent Education Experience
  OUTER APPLY (
    SELECT TOP 1 institutionName
    FROM education_experiences
    WHERE userId = c.user_id
    ORDER BY startDate DESC
  ) ee

  WHERE c.post_id = @postId
  GROUP BY 
    c.id,
    c.created_at,
    c.deleted,
    c.comment,
    c.isPinned,
    c.user_id,
    c.parent_comment_id,
    c.post_id,
    u.settings_PrivateJobNames,
    u.settings_PrivateSchoolNames,
    je.title,
    je.companyName,
    ee.institutionName
)
SELECT * FROM CommentCTE
WHERE NOT (deleted = 1 AND hasReplies = 0)
ORDER BY created_at DESC;

  `;

  const request = new sql.Request();
  request.input('postId', sql.VarChar, postId);
  if (user) request.input('userId', sql.VarChar, user.id);

  const result = await request.query(query);
  const comments = nestComments(result.recordset);

  await Promise.all(comments.map(comment => fetchCommentDetails(comment, user)));

  return comments;
}

function nestComments(commentList) {
  const commentMap = new Map();
  const nestedComments = [];

  commentList.forEach(comment => {
    if (comment.deleted && comment.hasReplies) {
      comment.comment = '[deleted]';
      comment.user_id = null; // We'll use this to set username to 'deleted' later
    }
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  commentList.forEach(comment => {
    if (comment.parent_comment_id && commentMap.has(comment.parent_comment_id)) {
      commentMap.get(comment.parent_comment_id).replies.push(commentMap.get(comment.id));
    } else {
      nestedComments.push(commentMap.get(comment.id));
    }
  });

  return nestedComments;
}

async function fetchCommentDetails(comment, user) {
  if (comment.deleted && comment.hasReplies) {
    comment.user = { username: 'deleted' };
  } else if (comment.user_id) {
    const [commentUser, parentUsername] = await Promise.all([
      getUserDetails(comment.user_id),
      comment.parent_comment_id ? postQueries.getParentAuthorUsernameByCommentId(comment.id) : null
    ]);

    comment.user = commentUser;
    if (parentUsername) {
      comment.parent_author = await userQueries.findByUsername(parentUsername);
      comment.replyingTo = comment.parent_comment_id ? 'comment' : 'post';
    }
  }

  if (comment.replies.length > 0) {
    await Promise.all(comment.replies.map(reply => fetchCommentDetails(reply, user)));
  }
}

router.get('/posts/:postId/edit', checkAuthenticated, async (req, res) => {
  try {
    const postId = req.params.postId;
    const post = await postQueries.getPostById(postId);
    if (post.user_id !== req.user.id) {
      return res.status(403).send('You are not authorized to edit this post');
    }
    post.community_name = await utilFunctions.getCommunityName(
      post.communities_id,
      false
    );
    post.tags = await utilFunctions.getTags(postId);
    //console.log(post.tags);

    res.render('edit-post.ejs', { user: req.user, post });
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).send('Error fetching post');
  }
});

router.put('/posts/:postId/edit', checkAuthenticated, async (req, res) => {
  PostController.updatePost(req, res);
});

// Route for deleting a post
router.delete('/post/:postId', checkAuthenticated, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  try {
    const post = await postQueries.getPostById(postId);
    if (post.user_id !== userId) {
      return res.status(403).send('You are not authorized to delete this post');
    }

    await postQueries.deletePostById(postId);
    res.render('communities.ejs' , { user: req.user, communityId: null, community: null, errorMessages: [], successMessages: ['Post deleted successfully'] });
  } catch (error) {
    res.status(500).send('Error deleting post');
  }
});

module.exports = router;
