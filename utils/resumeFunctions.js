const PDFDocument = require('pdfkit');
const fs = require('fs');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const { zodResponseFormat } = require('openai/helpers/zod');
const { z } = require('zod');
const openaiKey = process.env.OPENAI_API_KEY;
const { PassThrough } = require('stream');

const resumeFunctions = {
  createResume(data) {
    const doc = new PDFDocument({
      margin: 35,
      size: 'A4',
      font: 'Times-Roman',
    });
  
    const stream = new PassThrough();
    doc.pipe(stream);
  
    const maxContentHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  
    // Header
    doc.fontSize(24).font('Times-Bold').text(data.name, { align: 'center' });
    doc.fontSize(12).font('Times-Roman').text(`${data.email} | ${data.phone} | ${data.github}`, { align: 'center' });
  
    doc.moveDown();
  
    // Sections in order relevant to engineering
    if (data.professionalSummary) {
      this.addSection(doc, 'Professional Summary', data.professionalSummary, maxContentHeight);
    }
    if (data.skills) {
      this.addSection(doc, 'Skills', data.skills, maxContentHeight);
    }
    if (data.projects.length > 0) {
      this.addSection(doc, 'Projects', data.projects, maxContentHeight);
    }
    if (data.awards) {
      this.addSection(doc, 'Awards', data.awards, maxContentHeight);
    }
    if (data.publications) {
      this.addSection(doc, 'Publications', data.publications, maxContentHeight);
    }
    this.addSection(doc, 'Experience', data.experience, maxContentHeight);
    this.addSection(doc, 'Education', data.education, maxContentHeight);
    if (data.certifications) {
      this.addSection(doc, 'Certifications', data.certifications, maxContentHeight);
    }
    if (data.languages) {
      this.addSection(doc, 'Languages', data.languages, maxContentHeight);
    }
  
    doc.end();
  
    return stream;
  },
        
  addSection(doc, title, content, maxContentHeight) {
    const initialY = doc.y;
    const sectionHeight = this.calculateSectionHeight(doc, title, content);
    
    if (doc.y + sectionHeight > maxContentHeight) {
      return; // Skip section to keep resume within one page
    }
    
    doc.fontSize(14).font('Times-Bold').text(title);
    doc.moveTo(35, doc.y).lineTo(565, doc.y).stroke();
    doc.moveDown(0.2);
    
    doc.font('Times-Roman').fontSize(12);
    
    if (title === 'Skills' && Array.isArray(content)) {
      content.forEach(category => {
        const skills = category.skills.join(', ');
        doc.font('Times-Roman').text(`${category.category}: ${skills}`);
        doc.moveDown(0.2);
      });
    } else if (typeof content === 'string') {
      doc.text(content);
    } else if (Array.isArray(content)) {
  
      content.forEach(item => {
        if (typeof item === 'string') {
          doc.circle(doc.x - 5, doc.y + 6, 2).fill();
          doc.text(item, {indent: 10});
        } else if (typeof item === 'object') {
          if (title === 'Projects') {
            doc.font('Times-Bold').text(item.title);
            if (item.link) {
              doc.font('Times-Roman').fillColor('blue').text(item.link, {link: item.link});
              doc.fillColor('black');
            }
            if (item.description) {
              doc.font('Times-Roman').text(item.description);
            }
            if (item.technologies) {
              doc.font('Times-Italic').text(`Technologies: ${item.technologies.join(', ')}`);
            }
          } else {
            // For Experience and Education
            let leftContent = item.title;
            if (item.company) leftContent += `, ${item.company}`;
            if (item.location) leftContent += ` – ${item.location}`;
            let rightContent = item.date || item.year;
              
            doc.font('Times-Bold').text(leftContent, {continued: true})
              .font('Times-Roman').text(rightContent, {align: 'right'});
              
            if (item.details) {
              doc.moveDown(0.1);
              item.details.forEach(detail => {
                doc.font('Times-Roman').fontSize(12).text(`- ${detail}`, {indent: 15});
              });
            }
          }
          doc.moveDown(0.2);
        }
      });
    } else if (typeof content === 'object') {
      Object.entries(content).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`);
      });
    }
    
    doc.moveDown();
  },

  calculateSectionHeight(doc, title, content) {
    // Create a temporary PDFDocument to estimate the height
    const tempDoc = new PDFDocument({size: doc.page.size, margins: doc.page.margins});
    let height = 0;
  
    tempDoc.fontSize(14).font('Times-Bold');
    height += tempDoc.currentLineHeight();
    height += 5; // For the line stroke
  
    tempDoc.font('Times-Roman').fontSize(12);

    if (typeof content === 'string') {
      height += tempDoc.heightOfString(content);
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        if (typeof item === 'string') {
          height += tempDoc.heightOfString(item);
        } else if (typeof item === 'object') {
          height += tempDoc.heightOfString(item.title || '', {continued: true});
          height += tempDoc.heightOfString(item.date || item.year || '', {align: 'right'});
          if (item.details) {
            item.details.forEach(detail => {
              height += tempDoc.heightOfString(`- ${detail}`, {indent: 15});
            });
          }
        }
        height += tempDoc.currentLineHeight(); // Add spacing between items
      });
    } else if (typeof content === 'object') {
      Object.entries(content).forEach(([key, value]) => {
        height += tempDoc.heightOfString(`${key}: ${value}`);
      });
    }
  
    return height;
  },
  async processResume(filePath) {
    const dataBuffer = fs.readFileSync(filePath);

    try {
      const data = await pdf(dataBuffer);
      const extractedData = await this.extractResumeDataFromText(data.text);
      return extractedData;
    } catch (error) {
      console.error('Error processing resume:', error);
    }
  },

  async extractResumeDataFromText(text, userData = {}) {
    const openai = new OpenAI({ apiKey: openaiKey });

    const employmentTypeEnum = [
      'full_time',
      'part_time',
      'contract',
      'temporary',
      'internship',
    ];
  
    const experienceSchema = z.array(
      z.object({
        title: z.string().optional(),
        employmentType: z.string().optional(),
        companyName: z.string().optional(),
        location: z.string().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        tags: z.string().optional(),
        employmentHours: z.string().optional(),
        isCurrent: z.boolean().optional(),
      })
    );
  
    const educationSchema = z.array(
      z.object({
        institutionName: z.string().optional(),
        degree: z.string().optional(),
        fieldOfStudy: z.string().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        isCurrent: z.boolean().optional(),
        grade: z.string().nullable().optional(),
        activities: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      })
    );
  
    const resumeResponseSchema = z.object({
      firstname: z.string().optional(),
      lastname: z.string().optional(),
      email: z.string().optional(),
      phone_number: z.string().optional(),
      address: z.string().optional(),
      zipcode: z.string().optional(),
      professionalSummary: z.string().optional(),
      desired_job_title: z.string().optional(),
      preferred_industries: z.string().optional(),
      desired_location: z.string().optional(),
      employment_type: z.enum(employmentTypeEnum).optional(),
      languages: z.string().optional(),
      awards: z.string().nullable().optional(),
      publications: z.string().optional(),
      volunteer_experience: z.string().optional(),
      references: z.string().optional(),
      personal_websites: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      technical_skills: z.string().optional(),
      soft_skills: z.string().optional(),
      other_skills: z.string().optional(),
      projects: z.string().optional(),
      certifications: z.string().optional(),
      experience: experienceSchema.optional(),
      education: educationSchema.optional(),
    });
  
    const maxCharacters = 200000;
    const truncatedTextContent =
      text.length > maxCharacters ? text.slice(0, maxCharacters) : text;
  
    const functions = [
      {
        name: 'extract_resume_data',
        description: 'Extracts and fills in resume data from text. ',
        parameters: {
          type: 'object',
          properties: {
            firstname: { type: 'string', description: 'First name' },
            lastname: { type: 'string', description: 'Last name' },
            email: { type: 'string', description: 'Email address' },
            phone_number: { type: 'string', description: 'Phone number' },
            address: { type: 'string', description: 'Mailing address' },
            zipcode: { type: 'string', description: 'Zip code from address' },
            professionalSummary: { type: 'string', description: 'Professional summary' },
            languages: { type: 'string', description: 'Languages spoken' },
            awards: { type: 'string', description: 'Awards received' },
            publications: { type: 'string', description: 'Publications authored' },
            volunteer_experience: { type: 'string', description: 'Volunteer work' },
            references: { type: 'string', description: 'Professional references' },
            personal_websites: { type: 'string', description: 'Personal websites' },
            github: { type: 'string', description: 'GitHub username' },
            linkedin: { type: 'string', description: 'LinkedIn profile' },
            twitter: { type: 'string', description: 'Twitter handle' },
            technical_skills: { type: 'string', description: 'Technical skills' },
            soft_skills: { type: 'string', description: 'Soft skills' },
            other_skills: { type: 'string', description: 'Other skills' },
            projects: { type: 'string', description: 'Projects completed' },
            certifications: { type: 'string', description: 'Certifications obtained' },
            desired_job_title: { type: 'string', description: 'Desired job title' },
            preferred_industries: { type: 'string', description: 'Preferred industries' },
            desired_location: { type: 'string', description: 'Desired work location' },
            employment_type: {
              type: 'string',
              enum: employmentTypeEnum,
              description: 'Desired employment type, must be one of: ' + employmentTypeEnum.join(', '),
            },
            experience: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  employmentType: { type: 'string' },
                  companyName: { type: 'string' },
                  location: { type: 'string' },
                  startDate: { type: ['string', 'null'] },
                  endDate: { type: ['string', 'null'] },
                  description: { type: 'string' },
                  tags: { type: 'string' },
                  employmentHours: { type: 'string' },
                  isCurrent: { type: 'boolean' },
                },
              },
            },
            education: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  institutionName: { type: 'string' },
                  degree: { type: 'string' },
                  fieldOfStudy: { type: 'string' },
                  startDate: { type: ['string', 'null'] },
                  endDate: { type: ['string', 'null'] },
                  isCurrent: { type: 'boolean' },
                  grade: { type: 'string' },
                  activities: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
      },
    ];
  
    const messages = [
      {
        role: 'system',
        content:
        'You are an assistant that extracts resume data from text and fills in missing information when possible, based on the user-provided data. For the "employment_type" field, only use one of the following values: "full_time", "part_time", "contract", "temporary", "internship". Ensure the values are spelled exactly as specified, including underscores.',
      },
      {
        role: 'user',
        content: `You are an assistant that extracts resume data from text and fills in missing information when possible, based on the user-provided data. Fill in additional fields based on common assumption you can make from the data. Like that the user speaks english. Skills should always be fit into 3 categories, technical, soft skills and other. Skills should be comma separeted strings. Professional summary should be included or write a new one based on the data.
        This is an example of the data you should output:
        {
            firstname: { type: 'string', description: 'First name' },
            lastname: { type: 'string', description: 'Last name' },
            email: { type: 'string', description: 'Email address' },
            phone_number: { type: 'string', description: 'Phone number' },
            address: { type: 'string', description: 'Mailing address' },
            zipcode: { type: 'string', description: 'Zip code from address' },
            professionalSummary: { type: 'string', description: 'Professional summary' },
            languages: { type: 'string', description: 'Languages spoken' },
            awards: { type: 'string', description: 'Awards received' },
            publications: { type: 'string', description: 'Publications authored' },
            volunteer_experience: { type: 'string', description: 'Volunteer work' },
            references: { type: 'string', description: 'Professional references' },
            personal_websites: { type: 'string', description: 'Personal websites' },
            github: { type: 'string', description: 'GitHub username' },
            linkedin: { type: 'string', description: 'LinkedIn profile' },
            twitter: { type: 'string', description: 'Twitter handle' },
            technical_skills: { type: 'string', description: 'Technical skills' },
            soft_skills: { type: 'string', description: 'Soft skills' },
            other_skills: { type: 'string', description: 'Other skills' },
            projects: { type: 'string', description: 'Projects completed' },
            certifications: { type: 'string', description: 'Certifications obtained' },
            desired_job_title: { type: 'string', description: 'Desired job title' },
            preferred_industries: { type: 'string', description: 'Preferred industries' },
            desired_location: { type: 'string', description: 'Desired work location' },
            employment_type: { type: 'string', description: 'Desired employment type' },
            experience: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  employmentType: { type: 'string' },
                  companyName: { type: 'string' },
                  location: { type: 'string' },
                  startDate: { type: ['string', 'null'] },
                  endDate: { type: ['string', 'null'] },
                  description: { type: 'string' },
                  tags: { type: 'string' },
                  employmentHours: { type: 'string' },
                  isCurrent: { type: 'boolean' },
                },
              },
            },
            education: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  institutionName: { type: 'string' },
                  degree: { type: 'string' },
                  fieldOfStudy: { type: 'string' },
                  startDate: { type: ['string', 'null'] },
                  endDate: { type: ['string', 'null'] },
                  isCurrent: { type: 'boolean' },
                  grade: { type: 'string' },
                  activities: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
  
  Resume Text:
  ${truncatedTextContent}
  
  User Data:
  ${JSON.stringify(userData, null, 2)}
  `,
      },
    ];
  
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // or 'gpt-4' if you have access
        messages: messages,
        functions: functions,
        function_call: { name: 'extract_resume_data' },
        temperature: 0,
      });
  
      const message = completion.choices[0]?.message;
  
      if (message.function_call) {
        const functionArgs = JSON.parse(message.function_call.arguments);
        const mergedData = { ...userData, ...functionArgs };
        const validatedData = resumeResponseSchema.parse(mergedData);
        return validatedData;
      } else {
        throw new Error('No function_call in response');
      }
    } catch (error) {
      console.error('Error extracting resume data:', error.message);
      throw error;
    }
  },  
  
  async createResumeFromUserDataAndJob(user, job) {
    const experienceSchema = z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      date: z.string(),
      details: z.array(z.string())
    });
    
    const projectSchema = z.object({
      title: z.string(),
      link: z.string().optional(),
      details: z.array(z.string())
    });
    
    const educationSchema = z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      date: z.string(),
      details: z.array(z.string())
    });

    const skillCategorySchema = z.object({
      category: z.string(),
      skills: z.array(z.string())
    });
    
    const resumeSchema = z.object({
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      github: z.string(),
      professionalSummary: z.string(),
      skills: z.array(skillCategorySchema),
      experience: z.array(experienceSchema),
      projects: z.array(projectSchema),
      education: z.array(educationSchema),
      awards: z.string().optional(),
      publications: z.string().optional(),
      certifications: z.string().optional(),
      languages: z.string().optional()
    });
    
    console.log(user);
    console.log(job);
  
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
    const prompt = `
Create a resume for a software engineer named ${user.firstname} ${user.lastname} with the following information:
${JSON.stringify(user, null, 2)}

For the following job:
${job}

Your output should include the following sections:
- name
- email
- phone
- github
- professionalSummary (a brief summary of the candidate's experience and skills and how they align with the job description/requirements)
- skills (should be skills from the user's resume and implied skills that would be matching the job's required ones an array of objects, each with a 'category' (string) and 'skills' (array of strings))
- experience (title, company, location, date, details) for each job STAR method each bulletpoint or ensure it is a complete sentence that is relevant to the job.
- projects (title, link, details)
- education (title, company, location, date, details)
- awards (if present, a string)
- publications (if present, a string)
- certifications (if present, a string)
- languages (if present, a string)

Ensure that the data matches the schema provided.
`;
  
    try {
      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates a resume from user data and a job description. Output data that strictly conforms to the provided schema.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(resumeSchema, 'resumeSchema')
      });
  
      const message = completion.choices[0]?.message;
      const parsedData = resumeSchema.parse(JSON.parse(message.content));
      console.log(parsedData);
      return parsedData;
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }
  
  
  
};

module.exports = resumeFunctions;