const PDFDocument = require('pdfkit');
const fs = require('fs');
const pdf = require('pdf-parse');

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
    doc.fontSize(12).font('Times-Roman').text(`${data.email} | ${data.website} | ${data.github}`, {align: 'center'});
           
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
      console.log(data.text);
      const extractedData = this.extractDataFromText(data.text);
      // Update user's profile with extractedData
      // For example: updateUserProfile(userId, extractedData);
    } catch (error) {
      console.error('Error processing resume:', error);
    }
  },

  extractDataFromText(text) {

    // Use gpt to extract data from text
  }
  
};

module.exports = resumeFunctions;