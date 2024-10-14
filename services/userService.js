const { use } = require('passport');
const userQueries = require('../queries/userQueries');


class userProcessor  {
    constructor() {
        this.currentUsers = [];
    }

    async init() {
        const users = await userQueries.getUsers();
        this.currentUsers = users;
    }

    async getUnverifiedUsers() {
        const unverifiedUsers = await userQueries.getUnverifiedUsers();
        return unverifiedUsers;
    }

    async cleanUsers() {
        const unverifiedUsers = await this.getUnverifiedUsers();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deletedUsers = [];

        for (const user of unverifiedUsers) {
            if (new Date(user.created_at) < oneDayAgo) {
                deletedUsers.push(user);
                await userQueries.deleteUser(user.id);
            }
        }
        return deletedUsers;
    }

    start() {
        return this.cleanUsers();
    }
}

module.exports = userProcessor;