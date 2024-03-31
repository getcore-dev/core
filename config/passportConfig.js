const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const GitHubStrategy = require("passport-github2").Strategy;
const userQueries = require("../queries/userQueries");

function initialize(
  passport,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getUserByGitHubUsername,
  updateUserGitHubId,
  createUserFromGitHubProfile
) {
  const authenticateUser = async (username, password, done) => {
    try {
      const user = await getUserByUsername(username);
      if (user == null) {
        return done(null, false, {
          message: "No user with that username exists",
        });
      }

      if (await bcrypt.compare(password, user.password)) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Password incorrect" });
      }
    } catch (e) {
      console.error("Error in authentication:", e);
      return done(e);
    }
  };

  passport.use(
    new LocalStrategy({ usernameField: "username" }, authenticateUser)
  );

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "https://c-ore.dev/auth/github/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const githubUsername = profile.username;

          // Check if the user exists based on the GitHub username
          const existingUser = await getUserByGitHubUsername(githubUsername);

          if (existingUser) {
            // Update the user's GitHub ID if it doesn't exist
            if (!existingUser.github_id) {
              await updateUserGitHubId(existingUser.id, profile.id);
            }
            return done(null, existingUser);
          } else {
            // Create a new user in your database
            const newUser = await createUserFromGitHubProfile(profile);
            return done(null, newUser);
          }
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await getUserById(id);
      done(null, user);
    } catch (e) {
      console.error("Error in deserialization:", e);
      done(e, null);
    }
  });
}

module.exports = { initialize };
