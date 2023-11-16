const posts = [];

// retrieves all posts
exports.getAllPosts = (req, res) => {
  res.json(posts);
};

// create a new post
exports.createPost = (req, res) => {
  const newPost = {
    id: posts.length + 1, // create unique id for post
    content: req.body.content,
  };
  posts.push(newPost);
  res.status(201).json(newPost);
};

// retrieves a post by ID
exports.getPostById = (req, res) => {
  const post = posts.find((post) => post.id === parseInt(req.params.postId));

  if (!post) return res.status(404).send("Post not found");
  res.json(post);
};

// update post by ID
exports.updatePost = (req, res) => {
  const post = posts.find((post) => post.id === parseInt(req.params.postId));
  if (!post) return res.status(404).send("Post not found");

  // update post content
  post.content = req.body.content;
  // change other post properties
  res.json(post);
};

// delete a post by ID
exports.deletePost = (req, res) => {
  const index = posts.findIndex(
    (post) => post.id === parseInt(req.params.postId)
  );
  if (index === -1) return res.status(404).send("Post not found");

  const deletedPost = posts.splice(index, 1);
  res.status(200).json(deletedPost);
};
