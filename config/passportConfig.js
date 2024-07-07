const LocalStrategy = require('passport-local');
const bcrypt = require('bcrypt');
const GitHubStrategy = require('passport-github2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userQueries = require('../queries/userQueries');

function initialize(
  passport,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getUserByGitHubUsername,
  getUserByGitHubId,
  updateUserGitHubId,
  updateUserGitHubAccessToken,
  updateUserGitHubUsername,
  createUserFromGitHubProfile,
  getUserByGoogleId,
  createUserFromGoogleProfile
) {
  const authenticateUser = async (username, password, done) => {
    try {
      const user = await getUserByUsername(username);
      if (user == null) {
        return done(null, false, {
          message: 'No user with that username exists',
        });
      }

      if (user.isBanned) {
        return done(null, false, { message: 'User is banned' });
      }

      if (await bcrypt.compare(password, user.password)) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Password incorrect' });
      }
    } catch (e) {
      console.error('Error in authentication:', e);
      return done(e);
    }
  };

  passport.use(
    new LocalStrategy({ usernameField: 'username' }, authenticateUser)
  );

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: 'https://c-ore.dev/auth/github/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const githubUsername = profile.username;

          const existingUser =
            (await getUserByGitHubUsername(githubUsername)) ||
            (await getUserByGitHubId(profile.id));

          if (existingUser) {
            if (existingUser.isBanned) {
              return done(null, false, { message: 'User is banned' });
            }

            // Update the GitHub access token
            await updateUserGitHubAccessToken(existingUser.id, accessToken);

            // Update GitHub ID if not already set
            if (!existingUser.github_id) {
              await updateUserGitHubId(existingUser.id, profile.id);
            }

            // Update GitHub username if not already set
            if (!existingUser.github_username) {
              await updateUserGitHubUsername(existingUser.id, githubUsername);
            }

            return done(null, existingUser);
          } else {
            const newUser = await createUserFromGitHubProfile(profile);
            await updateUserGitHubAccessToken(newUser.id, accessToken);
            return done(null, newUser);
          }
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'https://c-ore.dev/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const existingUser = await getUserByGoogleId(profile.id);

          if (existingUser) {
            if (existingUser.isBanned) {
              return done(null, false, { message: 'User is banned' });
            }

            return done(null, existingUser);
          } else {
            const newUser = await createUserFromGoogleProfile(profile);
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
      console.error('Error in deserialization:', e);
      done(e, null);
    }
  });
}

module.exports = { initialize };
