

-- user table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    zip_code VARCHAR(20)
);

-- user_achievements table
CREATE TABLE user_achievements (
    user_id INT NOT NULL,
    achievement_id INT NOT NULL,
    achieved_date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(achievement_id),
    PRIMARY KEY (user_id, achievement_id)
);

-- user expertise table
CREATE TABLE user_expertise (
    expertise_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    expertise_area ENUM('JS', 'Python', 'HTML', 'CSS', ...) NOT NULL,
    experience_level ENUM('Beginner', 'Intermediate', 'Advanced') NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- achievements table
CREATE TABLE achievements (
    achievement_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- connections table
CREATE TABLE connections (
    connection_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id1 INT NOT NULL,
    user_id2 INT NOT NULL,
    status ENUM('pending', 'accepted') NOT NULL,
    FOREIGN KEY (user_id1) REFERENCES users(user_id),
    FOREIGN KEY (user_id2) REFERENCES users(user_id),
    UNIQUE (user_id1, user_id2)
);


-- learning modules table
CREATE TABLE learning_modules (
    module_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL
);

-- learning progress table
CREATE TABLE learning_progress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    course_name VARCHAR(100) NOT NULL,
    progress_percentage INT NOT NULL,
    last_updated DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- posts table
CREATE TABLE posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    last_edited DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- post edits table
CREATE TABLE post_edits (
    edit_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    edited_at DATETIME NOT NULL,
    edit_description TEXT,
    FOREIGN KEY (post_id) REFERENCES posts(post_id)
);


-- comments table
CREATE TABLE comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_text TEXT NOT NULL,
    commented_at DATETIME NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- reactions table
CREATE TABLE reactions (
    reaction_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    type ENUM('like', 'love', 'insightful', ...) NOT NULL,
    reacted_at DATETIME NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- forked post table
CREATE TABLE forked_posts (
    fork_id INT AUTO_INCREMENT PRIMARY KEY,
    original_post_id INT NOT NULL,
    forked_post_id INT NOT NULL,
    forked_at DATETIME NOT NULL,
    FOREIGN KEY (original_post_id) REFERENCES posts(post_id),
    FOREIGN KEY (forked_post_id) REFERENCES posts(post_id)
);

-- user-post interactions table
CREATE TABLE user_post_interactions (
    interaction_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    interaction_type ENUM('create', 'edit', 'delete', 'fork') NOT NULL,
    interaction_time DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id)
);
