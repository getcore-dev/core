// buttons on home page
function jobsButton() {
  window.location.href = "jobs.html";
}

function communityButton() {
  window.location.href = "communities.html";
<<<<<<< HEAD
}

function login() {
  window.location.href = "login.html";
}

function join() {
  window.location.href = "register.html";
}

function fetchTrendingPosts() {
  return [
    {
      title: "OpenAI releases GPT-5, thoughts?",
      content: "Lorem ipsum",
      user: "cat",
      community: "AI",
      reactions: [2595, 16],
      comments: 12,
    },
    {
      title: "What is your average total compensation and where do you live?",
      content: "Lorem ipsum",
      user: "user",
      community: "Questions",
      reactions: [147, 12],
      comments: 5,
    },
    {
      title: "What is your favorite programming language?",
      content: "Lorem ipsum",
      user: "bryce",
      community: "Programming",
      reactions: [95, 4],
      comments: 9,
    },
    {
      title: "What are some requested features for the  website? ",
      content: "Lorem ipsum",
      user: "admins",
      community: "Questions",
      reactions: [602, 32],
      comments: 22,
    },
  ];
}

=======
}
function fetchTrendingPosts() {
  return [
    {
      title: "OpenAI releases GPT-5, thoughts?",
      content: "Lorem ipsum",
      user: "cat",
      community: "AI",
      reactions: [2595, 16],
      comments: 12,
    },
    {
      title: "What is your average total compensation and where do you live?",
      content: "Lorem ipsum",
      user: "user",
      community: "Questions",
      reactions: [147, 12],
      comments: 5,
    },
    {
      title: "What is your favorite programming language?",
      content: "Lorem ipsum",
      user: "bryce",
      community: "Programming",
      reactions: [95, 4],
      comments: 9,
    },
    {
      title: "What are some requested features for the  website? ",
      content: "Lorem ipsum",
      user: "admins",
      community: "Questions",
      reactions: [602, 32],
      comments: 22,
    },
  ];
}

>>>>>>> origin/main
fetch("/check-session")
  .then((res) => res.json())
  .then((data) => {
    if (data.username) {
      document.getElementById("login").style.display = data.username;
      document.getElementById("join").style.display = "none";
    }
  });

function fetchTrendingProjects() {
  return [
    {
      title: "Indie development game release 515",
      content: "Lorem ipsum",
      user: "user",
      community: "GameDev",
      link: "https://www.google.com",
      reactions: [302, 18, 14, 22],
      comments: 65,
    },
    {
      title:
        "New tool to visualize the loss of different machine learning models",
      content: "Lorem ipsum",
      user: "user",
      community: "GameDev",
      link: "https://www.google.com",
      reactions: [147, 10, 4, 19],
      comments: 98,
    },
    {
      title: "Brand new tech startup for software engineers sells for $1.2B",
      content: "Lorem ipsum",
      user: "user",
      community: "Hype",
      link: "https://www.google.com",
      reactions: [102, 8, 2, 12],
      comments: 102,
    },
    {
      title:
        "I created an alternative to the app store which allows sideloading of any apps",
      content: "Lorem ipsum",
      user: "user",
      community: "iOS",
      link: "https://www.google.com",
      reactions: [98, 6, 3, 9],
      comments: 324,
    },
  ];
}

function displayTrendingPosts(posts) {
  const postsContainer = document.querySelector(".trending-posts");
  postsContainer.innerHTML = "<h3>Trending Posts</h3>"; // Clear existing posts

  posts.forEach((post) => {
    const postElement = document.createElement("div");
    postElement.className = "post";
    postElement.innerHTML = `
        <b><a href="">${post.title}</a></b>
        <br> ${post.comments} comments
        <a href="">${post.user}</a> in <a href="">${post.community}</a>   👍: ${post.reactions[0]} 👎: ${post.reactions[1]}</p>
        <br>
        `;
    postsContainer.appendChild(postElement);
  });
}

function displayTrendingProjects(projects) {
  const projectsContainer = document.querySelector(".trending-projects");
  projectsContainer.innerHTML = "<h3>Trending Projects</h3>"; // Clear existing projects

  projects.forEach((project) => {
    const projectElement = document.createElement("div");
    projectElement.className = "project";
    projectElement.innerHTML = `<p>
            <b><a href="">${project.title}</a></b>
            <br> ${project.comments} comments
            <a href="">${project.user}</a> in <a href="">${project.community}</a>   👍: ${project.reactions[0]} 👎: ${project.reactions[1]} 🤔: ${project.reactions[2]} ❤️: ${project.reactions[3]}</p>
            <br>
        `;
    projectsContainer.appendChild(projectElement);
  });
}

// Now we call the functions to display posts and projects
const postsData = fetchTrendingPosts();
const projectsData = fetchTrendingProjects();
displayTrendingPosts(postsData);
displayTrendingProjects(projectsData);

// user stuff
var loginBtn = document.getElementById("login-button");
var joinBtn = document.getElementById("join-button");
var jobsBtn = document.getElementById("jobs-button");
var comBtn = document.getElementById("community-button");

<<<<<<< HEAD
comBtn.addEventListener("click", communityButton);
jobsBtn.addEventListener("click", jobsButton);
loginBtn.addEventListener("click", login);
joinBtn.addEventListener("click", join);
=======
var jobsBtn = document.getElementById("jobs-button");
var comBtn = document.getElementById("community-button");

comBtn.addEventListener("click", communityButton);
jobsBtn.addEventListener("click", jobsButton);
>>>>>>> origin/main
