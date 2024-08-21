// autocompleteRoutes.js

const express = require('express');
const router = express.Router();
const cacheMiddleware = require('../middleware/cache');
const sql = require('mssql');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const communityQueries = require('../queries/communityQueries');
const postQueries = require('../queries/postQueries');
const jobQueries = require('../queries/jobQueries');
const userQueries = require('../queries/userQueries');
const techJobTitles = [
    'software engineer', 'full stack developer', 'frontend developer', 'backend developer', 'mobile developer', 
    'ios developer', 'android developer', 'devops engineer', 'data scientist', 'machine learning engineer',
    'ai engineer', 'artificial intelligence engineer', 'cloud architect', 'systems administrator', 
    'network engineer', 'cybersecurity analyst', 'database administrator', 'ui designer', 'ux designer',
    'product manager', 'project manager', 'scrum master', 'agile coach', 'quality assurance engineer',
    'site reliability engineer', 'data engineer', 'business intelligence analyst', 'technical writer',
    'it support specialist', 'systems architect', 'blockchain developer', 'game developer',
    'embedded systems engineer', 'computer vision engineer', 'robotics engineer', 'cloud engineer',
    'data analyst', 'systems engineer', 'information security analyst', 'web developer',
    'software architect', 'database developer', 'mobile app developer', 'cloud security specialist',
    'network administrator', 'it project manager', 'technology consultant', 'solutions architect',
    'enterprise architect', 'systems integrator', 'information systems manager', 'it director',
    'chief technology officer', 'chief information officer', 'technology manager', 'software development manager',
    'it operations manager', 'digital transformation specialist', 'technology strategist', 'it auditor',
    'data privacy officer', 'information architect', 'user experience researcher', 'virtual reality developer',
    'augmented reality developer', 'quantum computing researcher', 'iot developer', 'edge computing specialist',
    'bioinformatics specialist', 'computational linguist', 'natural language processing engineer',
    'big data engineer', 'data warehouse architect', 'etl developer', 'business systems analyst',
    'software quality assurance tester', 'penetration tester', 'ethical hacker', 'technology trainer',
    'digital forensics analyst', 'network security engineer', 'cloud solutions architect', 'devops architect',
    'machine learning ops engineer', 'ai ethics specialist', 'data governance specialist', 'api developer',
    'microservices architect', 'kubernetes specialist', 'containerization expert', 'low-code developer',
    'no-code platform specialist', 'robotic process automation developer', 'smart contract developer',
    'decentralized application developer', 'fintech developer', 'healthtech specialist', 'edtech developer',
    'game designer', 'game programmer', 'gameplay programmer', 'graphics programmer', '3d modeler',
    'game engine developer', 'audio programmer', 'technical artist', 'game producer', 'esports developer',
    'ar/vr game developer', 'mobile game developer', 'game ai programmer', 'game network programmer',
    'game physics programmer', 'game tools programmer', 'game ui programmer', 'game economy designer',
    'level designer', 'narrative designer', 'game systems designer', 'game analytics specialist',
    'game localization specialist', 'game qa tester', 'game community manager', 'game marketing specialist',
    'game monetization specialist', 'game live ops specialist', 'game backend developer',
    'game frontend developer', 'game full stack developer', 'game devops engineer', 'game producer',
    'game technical director', 'game art director', 'game creative director', 'game studio manager',
    'e-commerce developer', 'payment gateway integrator', 'search engine optimization specialist',
    'growth hacker', 'digital marketing technologist', 'marketing automation specialist',
    'crm developer', 'salesforce developer', 'sap consultant', 'erp specialist', 'technology evangelist',
    'developer advocate', 'open source maintainer', 'technology blogger', 'tech podcaster',
    'technology researcher', 'patent engineer', 'intellectual property specialist', 'legal tech specialist',
    'regulatory technology specialist', 'compliance technology specialist', 'quantum algorithm developer',
    'quantum software engineer', 'quantum hardware engineer', 'quantum cryptography specialist',
    'hpc specialist', 'supercomputing engineer', 'gpu computing specialist', 'fpga programmer',
    'asic designer', 'semiconductor engineer', 'computer hardware engineer', 'electronic design automation engineer',
    'vlsi designer', 'pcb designer', 'firmware engineer', 'robotics software engineer', 'computer vision engineer',
    'autonomous vehicle engineer', 'drone programmer', 'industrial automation specialist',
    'plc programmer', 'scada specialist', 'digital twin developer', 'simulation engineer',
    'computational fluid dynamics engineer', 'finite element analysis engineer', 'cad/cam specialist',
    '3d printing specialist', 'additive manufacturing engineer', 'nanotechnology specialist',
    'biomedical engineer', 'bioinformatics developer', 'computational biologist', 'health informatics specialist',
    'medical imaging software developer', 'telemedicine platform developer', 'health data analyst',
    'clinical systems integrator', 'electronic health record specialist', 'healthcare cybersecurity specialist',
    'geospatial developer', 'gis specialist', 'remote sensing analyst', 'climate modeling specialist',
    'environmental data scientist', 'smart city technologist', 'energy management systems developer',
    'renewable energy systems engineer', 'smart grid specialist', 'building information modeling specialist',
    'digital twin architect', 'predictive maintenance engineer', 'reliability engineer',
    'logistics systems developer', 'supply chain technology specialist', 'inventory management systems developer',
    'warehouse automation specialist', 'transportation systems engineer', 'traffic management systems developer',
    'fleet management systems developer', 'aviation systems engineer', 'avionics software engineer',
    'aerospace systems engineer', 'satellite systems engineer', 'space systems engineer',
    'telecommunications engineer', '5g network engineer', 'voip specialist', 'network protocols developer',
    'software defined networking specialist', 'network function virtualization engineer',
    'optical network engineer', 'radio frequency engineer', 'antenna design engineer', 'wireless systems engineer',
    'broadcast engineer', 'audio engineer', 'video engineer', 'streaming media specialist',
    'digital signal processing engineer', 'image processing engineer', 'compression algorithm developer',
    'codec developer', 'multimedia systems engineer', 'digital rights management specialist',
    'content delivery network engineer', 'web performance engineer', 'frontend performance specialist',
    'web accessibility specialist', 'internationalization engineer', 'localization engineer',
    'technical seo specialist', 'amp developer', 'progressive web app developer', 'webrtc developer',
    'websocket specialist', 'browser extension developer', 'web standards contributor',
    'w3c working group member', 'web cryptography engineer', 'web authentication specialist',
    'web security engineer', 'oauth specialist', 'identity management developer', 'single sign-on specialist',
    'multi-factor authentication developer', 'biometric authentication specialist',
    'digital identity systems architect', 'blockchain identity specialist', 'decentralized identity developer',
    'zero-knowledge proof developer', 'homomorphic encryption specialist', 'post-quantum cryptography developer',
    'secure multiparty computation developer', 'distributed systems engineer', 'consensus algorithm developer',
    'peer-to-peer systems developer', 'distributed ledger technology specialist', 'cap theorem specialist',
    'eventual consistency expert', 'distributed database developer', 'time series database specialist',
    'graph database developer', 'document database developer', 'key-value store developer',
    'multi-model database developer', 'newSQL database developer', 'data lake architect',
    'data mesh architect', 'data fabric designer', 'master data management specialist',
    'data quality engineer', 'data lineage specialist', 'data catalog developer',
    'metadata management specialist', 'data modeling specialist', 'data integration specialist',
    'etl/elt developer', 'data pipeline engineer', 'stream processing engineer', 'real-time analytics developer',
    'batch processing specialist', 'data workflow orchestrator', 'data versioning specialist',
    'data drift detection engineer', 'feature store developer', 'mlops engineer', 'ml pipeline developer',
    'automl developer', 'neural architecture search specialist', 'reinforcement learning engineer',
    'federated learning specialist', 'transfer learning specialist', 'few-shot learning specialist',
    'meta-learning specialist', 'explainable ai developer', 'ai fairness specialist',
    'ai safety researcher', 'ai alignment researcher', 'nlp engineer', 'speech recognition engineer',
    'text-to-speech engineer', 'chatbot developer', 'conversational ai specialist',
    'sentiment analysis specialist', 'named entity recognition specialist', 'machine translation engineer',
    'question answering systems developer', 'text summarization specialist', 'information retrieval specialist',
    'recommendation systems engineer', 'personalization algorithms developer', 'anomaly detection specialist',
    'fraud detection systems developer', 'predictive maintenance algorithm developer',
    'demand forecasting specialist', 'price optimization engineer', 'revenue management systems developer',
    'operations research specialist', 'simulation modeling expert', 'digital twin developer',
    'synthetic data generator', 'data augmentation specialist', 'adversarial machine learning specialist',
    'model compression specialist', 'edge ai developer', 'tinyml developer', 'neuromorphic computing specialist',
    'quantum machine learning researcher', 'computational neuroscience researcher',
    'brain-computer interface developer', 'neurorobotics engineer', 'affective computing specialist',
    'emotion ai developer', 'behavioral analytics specialist', 'cognitive systems engineer',
    'human-in-the-loop ai developer', 'augmented intelligence specialist', 'human-ai collaboration systems developer'
  ];

  const stateMappings = {
    Alabama: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    Florida: 'FL',
    Georgia: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Pennsylvania: 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY',
    'United States': 'US',
  };
  
  const countryMappings = {
    'United States': 'USA',
    'United Kingdom': 'UK',
    'Canada': 'CAN',
    'Australia': 'AUS',
    'Germany': 'DEU',
    'France': 'FRA',
    'Japan': 'JPN',
    'China': 'CHN',
    'India': 'IND',
    'Brazil': 'BRA',
    'Russia': 'RUS',
    'South Korea': 'KOR',
    'Italy': 'ITA',
    'Spain': 'ESP',
    'Mexico': 'MEX',
    'Netherlands': 'NLD',
    'Saudi Arabia': 'SAU',
    'Turkey': 'TUR',
    'Switzerland': 'CHE',
    'Argentina': 'ARG',
    'South Africa': 'ZAF',
    'Sweden': 'SWE',
    'Belgium': 'BEL',
    'Norway': 'NOR',
    'Austria': 'AUT',
    'Denmark': 'DNK',
    'Finland': 'FIN',
    'Greece': 'GRC',
    'Ireland': 'IRL',
    'Portugal': 'PRT',
    'Poland': 'POL',
    'Czech Republic': 'CZE',
    'Hungary': 'HUN',
    'New Zealand': 'NZL',
    'Singapore': 'SGP',
    'Malaysia': 'MYS',
    'Philippines': 'PHL',
    'Thailand': 'THA',
    'Indonesia': 'IDN',
    'Vietnam': 'VNM',
    'Israel': 'ISR',
    'United Arab Emirates': 'ARE',
    'Chile': 'CHL',
    'Colombia': 'COL',
    'Peru': 'PER',
    'Pakistan': 'PAK',
    'Bangladesh': 'BGD',
    'Nigeria': 'NGA',
    'Egypt': 'EGY',
    'Ukraine': 'UKR',
    'Romania': 'ROU',
    'Kazakhstan': 'KAZ',
    'Qatar': 'QAT',
    'Kuwait': 'KWT',
    'Bulgaria': 'BGR',
    'Croatia': 'HRV',
    'Lithuania': 'LTU',
    'Slovakia': 'SVK',
    'Slovenia': 'SVN',
    'Latvia': 'LVA',
    'Estonia': 'EST',
    'Luxembourg': 'LUX',
    'Iceland': 'ISL',
    'Malta': 'MLT',
    'Cyprus': 'CYP',
    'Serbia': 'SRB',
    'Montenegro': 'MNE',
    'North Macedonia': 'MKD',
    'Bosnia and Herzegovina': 'BIH',
    'Albania': 'ALB',
    'Georgia': 'GEO',
    'Armenia': 'ARM',
    'Azerbaijan': 'AZE',
    'Belarus': 'BLR',
    'Moldova': 'MDA',
    'Uzbekistan': 'UZB',
    'Turkmenistan': 'TKM',
    'Kyrgyzstan': 'KGZ',
    'Tajikistan': 'TJK',
    'Morocco': 'MAR',
    'Tunisia': 'TUN',
    'Algeria': 'DZA',
    'Libya': 'LBY',
    'Sudan': 'SDN',
    'Ethiopia': 'ETH',
    'Kenya': 'KEN',
    'Uganda': 'UGA',
    'Tanzania': 'TZA',
    'Ghana': 'GHA',
    'Ivory Coast': 'CIV',
    'Cameroon': 'CMR',
    'Senegal': 'SEN',
    'Zimbabwe': 'ZWE',
    'Zambia': 'ZMB',
    'Angola': 'AGO',
    'Mozambique': 'MOZ',
    'Namibia': 'NAM',
    'Botswana': 'BWA',
    'Malawi': 'MWI',
    'Rwanda': 'RWA',
    'Burundi': 'BDI',
    'Mauritius': 'MUS',
    'Madagascar': 'MDG',
    'Seychelles': 'SYC',
    'Lesotho': 'LSO',
    'Eswatini': 'SWZ',
    'Comoros': 'COM',
    'Djibouti': 'DJI',
    'Eritrea': 'ERI',
    'Somalia': 'SOM',
    'Hong Kong': 'HK',
    'Guatemala': 'GTM',
    'Gabon': 'GAB',
    'Equatorial Guinea': 'GNQ',
    'Central African Republic': 'CAF',
    'Chad': 'TCD',
    'Niger': 'NER',
    'Mali': 'MLI',
    'Burkina Faso': 'BFA',
    'Benin': 'BEN',
    'Togo': 'TGO',
    'Sierra Leone': 'SLE',
    'Liberia': 'LBR',
    'Guinea': 'GIN',
    'Guinea-Bissau': 'GNB',
    'Gambia': 'GMB',
    'Cape Verde': 'CPV',
    'Mauritania': 'MRT',
    'Western Sahara': 'ESH',
    'Palestine': 'PSE',
    'Lebanon': 'LBN',
    'Jordan': 'JOR',
    'Syria': 'SYR',
    'Iraq': 'IRQ',
    'Yemen': 'YEM',
    'Oman': 'OMN',
    'Bahrain': 'BHR',
    'Sri Lanka': 'LKA',
    'Nepal': 'NPL',
    'Bhutan': 'BTN',
    'Maldives': 'MDV',
    'Myanmar': 'MMR',
    'Laos': 'LAO',
    'Cambodia': 'KHM',
    'Brunei': 'BRN',
    'East Timor': 'TLS',
    'Papua New Guinea': 'PNG',
    'Fiji': 'FJI',
    'Samoa': 'WSM',
    'Tonga': 'TON',
    'Vanuatu': 'VUT',
    'Solomon Islands': 'SLB',
    'Micronesia': 'FSM',
    'Marshall Islands': 'MHL',
    'Palau': 'PLW',
    'Kiribati': 'KIR',
    'Nauru': 'NRU',
    'Tuvalu': 'TUV',
  };

  const jobLevels = [
    "Internship", "Entry Level", "Mid Level", "Senior", "Lead",
    "Manager", "Director", "VP",
  ];

  router.get('/users', cacheMiddleware(600, 'autocomplete:users:'), async (req, res) => {
    const searchTerm = req.query.term;
    
    try {
        const users = await userQueries.searchUsers(searchTerm);
        res.json(users);
    } catch (err) {
        console.error('Error searching users:', err);
        res.status(500).send('Error searching users');
    }
});

router.get('/jobs', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const jobs = await jobQueries.searchJobs(searchTerm);
        res.json(jobs);
    } catch (err) {
        console.error('Error searching jobs:', err);
        res.status(500).send('Error searching jobs');
    }
});

router.get('/job-levels', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    const filteredLevels = jobLevels.filter(level => level.toLowerCase().includes(searchTerm.toLowerCase()));

    try {
        const levelsWithJobCounts = await Promise.all(filteredLevels.map(async (level) => {
            const jobs = await jobQueries.searchJobLevels(level);
            return jobs.length > 0 ? { level, jobCount: jobs.length } : null;
        }
        ));

        res.json(levelsWithJobCounts);
    }
    catch (err) {
        console.error('Error searching job levels:', err);
        res.status(500).send('Error searching job levels');
    }
});
router.get('/job-locations', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    // Check if it's in stateMappings or countryMappings
    const locations = Object.keys(stateMappings).concat(Object.keys(countryMappings));
    const filteredLocations = locations.filter(location => 
        location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    try {
        // Search for jobs with each of the filtered locations
        const locationCounts = await Promise.all(filteredLocations.map(async (location) => {
            const result = await jobQueries.searchJobLocations(location);
            
            // Sum up job counts for all locations that contain this state/country
            const totalJobCount = result.reduce((sum, item) => {
                if (item.location.toLowerCase().includes(location.toLowerCase())) {
                    return sum + item.jobCount;
                }
                return sum;
            }, 0);

            return totalJobCount > 0 ? { location, jobCount: totalJobCount } : null;
        }));

        // Filter out any null results
        const validLocationCounts = locationCounts.filter(item => item !== null);

        res.json(validLocationCounts);
    } catch (error) {
        console.error('Error searching job locations:', error);
        res.status(500).json({ error: 'An error occurred while searching for job locations' });
    }
});

router.get('/job-levels', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    const filteredLevels = jobLevels.filter(level => level.toLowerCase().includes(searchTerm.toLowerCase()));
    res.json(filteredLevels);
});



router.get('/tech-job-titles', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    try {
        // Generate a list of potential tech job titles based on the search term
        const potentialTitles = techJobTitles.filter(title => title.toLowerCase().includes(searchTerm.toLowerCase()));

        // Filter the titles and get the job count for each
        const titlesWithJobCounts = await Promise.all(potentialTitles.map(async (title) => {
            const jobs = await jobQueries.searchJobs(title);
            return jobs.length > 0 ? { title, jobCount: jobs.length } : null;
        }));

        // Remove null values, sort by job count in descending order, and send the result
        const validTitlesWithCounts = titlesWithJobCounts
            .filter(item => item !== null)
            .sort((a, b) => b.jobCount - a.jobCount);

        res.json(validTitlesWithCounts);
    } catch (err) {
        console.error('Error searching tech job titles:', err);
        res.status(500).send('Error searching tech job titles');
    }
});

router.get('/skills', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const skills = await jobQueries.searchSkills(searchTerm);
        res.json(skills);
    } catch (err) {
        console.error('Error searching skills:', err);
        res.status(500).send('Error searching skills');
    }
});

router.get('/companies', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const companies = await jobQueries.searchCompanies(searchTerm);
        res.json(companies);
    } catch (err) {
        console.error('Error searching companies:', err);
        res.status(500).send('Error searching companies');
    }
});

router.get('/posts', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const posts = await postQueries.searchPosts(searchTerm);
        res.json(posts);
    } catch (err) {
        console.error('Error searching posts:', err);
        res.status(500).send('Error searching posts');
    }
});

router.get('/all', cacheMiddleware(600), async (req, res) => {
    const searchTerm = req.query.term;

    try {
        const posts = await postQueries.searchPosts(searchTerm);
        const users = await userQueries.searchUsers(searchTerm);
        const jobs = await jobQueries.searchJobs(searchTerm);
        const communities = await communityQueries.searchCommunities(searchTerm);
        const companies = await jobQueries.searchCompanies(searchTerm);

        res.json({ users, posts, jobs, communities, companies });
    } catch (err) {
        console.error('Error searching all:', err);
        res.status(500).send('Error searching all');
    }
});

module.exports = router;