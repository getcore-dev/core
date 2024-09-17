const PDFDocument = require('pdfkit');
const fs = require('fs');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const { zodResponseFormat } = require('openai/helpers/zod');
const { z } = require('zod');
const openaiKey = process.env.OPENAI_API_KEY;


const resumeFunctions = {
  createResume(data) { 
    const doc = new PDFDocument({
      margin: 35,
      size: 'A4',
      font: 'Times-Roman',
    });
    doc.pipe(fs.createWriteStream('resume.pdf'));
    
    const maxContentHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    
    // Header
    doc.fontSize(24).font('Times-Bold').text(data.name, {align: 'center'});
    doc.fontSize(12).font('Times-Roman').text(`${data.email} | ${data.phone} | ${data.github}`, {align: 'center'});
           
    doc.moveDown();
    
    // Sections in order relevant to engineering
    this.addSection(doc, 'Skills', data.skills, maxContentHeight);
    this.addSection(doc, 'Projects', data.projects, maxContentHeight);
    this.addSection(doc, 'Experience', data.experience, maxContentHeight);
    this.addSection(doc, 'Education', data.education, maxContentHeight);
    if (data.certifications) {
      this.addSection(doc, 'Certifications', data.certifications, maxContentHeight);
    }
    
    doc.end();
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
    
    if (Array.isArray(content)) {
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
  
    if (Array.isArray(content)) {
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

  async extractResumeDataFromText(text) {
    const openai = new OpenAI({ apiKey: openaiKey });
  
    const experienceSchema = z.array(z.object({
      title: z.string(),
      employmentType: z.string(),
      companyName: z.string(),
      location: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      description: z.string(),
      tags: z.string(),
      employmentHours: z.string(),
      isCurrent: z.boolean()
    }));
  
    const educationSchema = z.array(z.object({
      institutionName: z.string(),
      degree: z.string(),
      fieldOfStudy: z.string(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      grade: z.string(),
      activities: z.string(),
      description: z.string()
    }));
  
    const resumeResponse = z.object({
      firstname: z.string(),
      lastname: z.string(),
      email: z.string(),
      phone_number: z.string(),
      address: z.string(),
      professional_summary: z.string(),
      languages: z.string(),
      awards: z.string(),
      publications: z.string(),
      volunteer_experience: z.string(),
      references: z.string(),
      personal_websites: z.string(),
      github: z.string(),
      linkedin: z.string(),
      twitter: z.string(),
      technical_skills: z.string(),
      soft_skills: z.string(),
      other_skills: z.string(),
      projects: z.string(),
      certifications: z.string(),
      experience: experienceSchema,
      education: educationSchema
    });
  
    const maxCharacters = 200000;
    const truncatedTextContent = text.length > maxCharacters ? text.slice(0, maxCharacters) : text;
  
    const prompt = `
    From the following resume text, extract the following information:
  
    - firstname
    - lastname
    - email
    - phone number
    - address
    - professional_summary
    - languages (default English)
    - awards
    - publications
    - volunteer_experience
    - references
    - personal_websites 
    - github (GitHub username)
    - linkedin
    - twitter
    - technical_skills (comma-separated)
    - soft_skills (comma-separated)
    - other_skills (comma-separated)
    - projects
    - certifications
  
    For each job experience, include the following fields:
    - title
    - employmentType
    - companyName
    - location
    - startDate (nullable)
    - endDate (nullable)
    - description
    - tags
    - employmentHours
    - isCurrent
  
    For each education experience, include the following fields:
    - institutionName
    - degree 
    - fieldOfStudy 
    - startDate (nullable)
    - endDate (nullable)
    - isCurrent
    - grade (GPA)
    - activities
    - description
  
    ${truncatedTextContent}
    `;
  
    try {
      const completion = await openai.beta.chat.completions.parse({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts resume data from text.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(resumeResponse, 'resumeResponse')
      });
  
      const message = completion.choices[0]?.message;
      console.log(message);
      return message.parsed;
    } catch (error) {
      console.error('OpenAI API Error:', error.message);
      throw error;
    }
  }
  
  
};

module.exports = resumeFunctions;