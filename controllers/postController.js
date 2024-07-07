const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const Community = require("../models/Community");
const {
  getLinkPreview,
  linkify,
  getCommunityDetails,
  getGitHubRepoPreview,
  getFavicon,
} = require("../utils/utilFunctions");
const marked = require("marked");

class PostController {
  static async getAllPosts(req, res) {
    try {
      const posts = await Post.getAll();
      res.render("posts.ejs", { user: req.user, error: null, posts: posts });
    } catch (err) {
      console.error("Database query error:", err);
      const error = { status: 500, message: "Error fetching posts" };
      res.render("error.ejs", { user: req.user, error });
    }
  }

  static async createPost(req, res) {
    try {
      const { userId, title, content, link, community_id, tags, post_type } =
        req.body;
      const postId = await Post.create(
        userId,
        title,
        content,
        link,
        community_id,
        tags || [],
        post_type
      );
      res.redirect(`/posts/${postId}`);
    } catch (err) {
      console.error("Database insert error:", err);
      res.status(500).render("error.ejs", {
        error: { status: 500, message: "Error creating post" },
      });
    }
  }

  static async acceptAnswer(req, res) {
    try {
      const { postId, commentId } = req.params;
      const userId = req.user.id;
      const result = await Post.acceptAnswer(postId, commentId, userId);
      if (result) {
        res.redirect(`/posts/${postId}`);
      }
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).send("Error accepting answer");
    }
  }

  static async reactToPost(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.user.id;
      const action = req.body.action.toUpperCase();
      const validActions = ["LOVE", "LIKE", "CURIOUS", "DISLIKE"];

      if (!validActions.includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      const result = await Post.interact(postId, userId, action);

      res.json({
        message: `Post reaction updated successfully`,
        userReaction: result.userReaction,
        newReactions: result.reactionsMap,
      });
    } catch (err) {
      console.error("Database error:", err);
      res.status(500).json({ error: "Error processing reaction" });
    }
  }

  static async nestComments(comments) {
    const commentMap = {};
    const rootComments = [];

    comments.forEach((comment) => {
      commentMap[comment.id] = comment;
      comment.replies = [];
    });

    comments.forEach((comment) => {
      if (comment.parentCommentId) {
        const parent = commentMap[comment.parentCommentId];
        if (parent) {
          parent.replies.push(comment);
        } else {
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });

    return rootComments;
  }

  static async getPostById(req, res) {
    try {
      const { postId } = req.params;
      const user = req.user;

      await Comment.removeDuplicateActions();
      await Post.removeDuplicateActions();

      if (!req.rateLimit || !req.rateLimit.exceeded) {
        await Post.incrementViews(postId);
      }

      const post = await Post.getById(postId);
      if (!post) {
        return res.status(404).send("Post not found");
      }

      post.tags = await post.getTags();
      post.user = await User.findById(post.userId);

      // Fetch comments and populate user information
      const comments = await Comment.getByPostId(postId);
      const populatedComments = await Promise.all(
        comments.map(async (comment) => {
          comment.user = await User.findById(comment.userId);
          if (comment.parentCommentId) {
            const parentComment = comments.find(
              (c) => c.id === comment.parentCommentId
            );
            if (parentComment) {
              comment.parentAuthor = parentComment.user;
            }
          }
          return comment;
        })
      );

      // Nest comments
      const nestedComments = PostController.nestComments(populatedComments);
      post.comments = nestedComments;

      post.community = await Community.getById(post.communityId);

      if (post.link && post.postType === "project") {
        post.gitHubfavicon = await getFavicon(post.link);
        post.gitHubLinkPreview = await getGitHubRepoPreview(post.link);
        post.gitHubMatchUsername =
          post.user.githubUsername ===
          JSON.parse(post.gitHubLinkPreview.raw_json).owner.login;
      }

      if (post.postType === "question") {
        post.solution = await Post.getAcceptedAnswer(postId);
        if (post.solution) {
          post.solution.user = await User.findById(post.solution.userId);
        }
      }

      if (post.link) {
        post.linkPreview = await getLinkPreview(post.link);
      }

      post.content = marked.parse(post.content);

      const similarPosts = await Post.fetchSimilarPosts(
        user,
        postId,
        post.communityId,
        post.tags,
        post.title
      );

      res.render("post.ejs", {
        post,
        user: req.user,
        communityId: post.communityId,
        community: post.community,
        linkify,
        similarPosts,
      });
    } catch (err) {
      console.error("Database query error:", err);
      res.status(500).send("Error fetching post and comments");
    }
  }

  static async getEditPost(req, res) {
    try {
      const { postId } = req.params;
      const post = await Post.getById(postId);
      if (post.userId !== req.user.id) {
        return res.status(403).send("You are not authorized to edit this post");
      }
      post.communityName = await Community.getNameById(post.communityId);
      post.tags = await post.getTags();
      res.render("edit-post.ejs", { user: req.user, post });
    } catch (err) {
      console.error("Database query error:", err);
      res.status(500).send("Error fetching post");
    }
  }

  static async updatePost(req, res) {
    try {
      const { postId } = req.params;
      if (!req.body.tags) {
        req.body.tags = [];
      }

      const postData = {
        ...req.body,
        tags: req.body.tags,
      };

      const post = await Post.getById(postId);
      if (!post) {
        return res.status(404).send("Post not found");
      }

      if (post.userId !== req.user.id) {
        return res.status(403).send("You are not authorized to edit this post");
      }

      console.log(postData);

      const updatedPost = await Post.edit(postId, postData);
      if (updatedPost) {
        res.redirect(`/posts/${postId}`);
      } else {
        throw new Error("Post update failed");
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Server error");
    }
  }

  static async deletePost(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.user.id;

      const post = await Post.getById(postId);
      if (post.userId !== userId) {
        return res
          .status(403)
          .send("You are not authorized to delete this post");
      }

      await post.delete();
      res.redirect("/");
    } catch (error) {
      res.status(500).send("Error deleting post");
    }
  }

  static async createFeedback(req, res) {
    try {
      const { userId, title, attachmentUrl, body } = req.body;
      const postId = await Post.createFeedback(
        userId,
        title,
        attachmentUrl,
        body
      );
      res.redirect(`/posts/${postId}`);
    } catch (err) {
      console.error("Database insert error:", err);
      res.status(500).render("error.ejs", {
        error: { status: 500, message: "Error creating feedback" },
      });
    }
  }

  static async getPostsByCommunity(req, res) {
    try {
      const { communityId } = req.params;
      const posts = await Post.fetchPostsByCommunity(communityId);
      const community = await Community.getById(communityId);
      res.render("community-posts.ejs", { user: req.user, posts, community });
    } catch (err) {
      console.error("Database query error:", err);
      res.status(500).send("Error fetching community posts");
    }
  }

  static async getPostsByTag(req, res) {
    try {
      const { tagId } = req.params;
      const posts = await Post.getByTag(tagId);
      const tag = await Post.getTagId(tagId);
      res.render("tag-posts.ejs", { user: req.user, posts, tag });
    } catch (err) {
      console.error("Database query error:", err);
      res.status(500).send("Error fetching posts by tag");
    }
  }

  static async toggleLockPost(req, res) {
    try {
      const { postId } = req.params;
      const post = await Post.getById(postId);
      const result = await post.toggleLock();
      res.json(result);
    } catch (err) {
      console.error("Database update error:", err);
      res.status(500).send("Error toggling post lock");
    }
  }
}

module.exports = PostController;
