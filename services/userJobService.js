const sanitizeHtml = require("sanitize-html"); // Import the sanitization library
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const OpenAI = require("openai");
const { zodResponseFormat } = require("openai/helpers/zod");
const { z } = require("zod");
const jobQueries = require("../queries/jobQueries");

class UserProcessor {
    constructor(userJobService) {
        this.userJobService = userJobService;
    }
    
    async getMatchScore(job, user) {
        
    }
}

module.exports = UserProcessor;
