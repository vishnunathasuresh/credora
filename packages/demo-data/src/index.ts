export type DemoCredential = {
  id: string;
  skillName: string;
  skillLevel: string;
  issueDate: string;
  marks: { scored: number; maximum: number; grade: string };
  learnerAddress: `0x${string}`;
  status: 'synthetic-demo';
};

export type DemoCourse = {
  id: string;
  code: string;
  name: string;
  level: 'Foundational' | 'Intermediate' | 'Advanced';
  duration: string;
  credits: number;
  status: 'synthetic-demo';
};

export type DemoCertification = {
  id: string;
  name: string;
  level: 'Certificate' | 'Professional Certificate' | 'Advanced Certificate';
  assessment: string;
  status: 'synthetic-demo';
};

export type DemoLearner = {
  id: string;
  displayName: string;
  walletAddress: `0x${string}`;
  credentials: DemoCredential[];
};

export type DemoOrganization = {
  id: string;
  name: string;
  shortName: string;
  category: 'IIT' | 'NIT' | 'IIIT';
  city: string;
  website: string;
  status: 'synthetic-demo';
  courses: DemoCourse[];
  certifications: DemoCertification[];
  learners: DemoLearner[];
};

export const demoCatalog = {
  status: 'synthetic-demo' as const,
  disclaimer:
    'These institutions, learners, marks, and credentials are synthetic showcase data. They are not affiliated with or issued by the named institutions.',
  organizations: [
    {
      id: 'iit-bombay-demo',
      name: 'Indian Institute of Technology Bombay',
      shortName: 'IIT Bombay',
      category: 'IIT',
      city: 'Mumbai',
      website: 'https://www.iitb.ac.in',
      status: 'synthetic-demo',
      courses: [
        {
          id: 'iitb-course-distributed-systems',
          code: 'CS 701',
          name: 'Distributed Systems',
          level: 'Advanced',
          duration: '12 weeks',
          credits: 4,
          status: 'synthetic-demo',
        },
        {
          id: 'iitb-course-applied-cryptography',
          code: 'CS 643',
          name: 'Applied Cryptography',
          level: 'Advanced',
          duration: '10 weeks',
          credits: 3,
          status: 'synthetic-demo',
        },
      ],
      certifications: [
        {
          id: 'iitb-cert-secure-distributed-systems',
          name: 'Secure Distributed Systems',
          level: 'Advanced Certificate',
          assessment: 'Project + viva',
          status: 'synthetic-demo',
        },
        {
          id: 'iitb-cert-applied-cryptography',
          name: 'Applied Cryptography Practitioner',
          level: 'Professional Certificate',
          assessment: 'Proctored assessment',
          status: 'synthetic-demo',
        },
      ],
      learners: [
        {
          id: 'learner-aanya-kapoor',
          displayName: 'Aanya Kapoor',
          walletAddress: '0x1000000000000000000000000000000000000001',
          credentials: [
            {
              id: 'iitb-aanya-distributed-systems',
              skillName: 'Distributed Systems',
              skillLevel: 'Advanced',
              issueDate: '2026-08-11',
              marks: { scored: 91, maximum: 100, grade: 'A+' },
              learnerAddress: '0x1000000000000000000000000000000000000001',
              status: 'synthetic-demo',
            },
            {
              id: 'iitb-aanya-cryptography',
              skillName: 'Applied Cryptography',
              skillLevel: 'Proficient',
              issueDate: '2026-07-28',
              marks: { scored: 86, maximum: 100, grade: 'A' },
              learnerAddress: '0x1000000000000000000000000000000000000001',
              status: 'synthetic-demo',
            },
          ],
        },
      ],
    },
    {
      id: 'nit-trichy-demo',
      name: 'National Institute of Technology Tiruchirappalli',
      shortName: 'NIT Trichy',
      category: 'NIT',
      city: 'Tiruchirappalli',
      website: 'https://www.nitt.edu',
      status: 'synthetic-demo',
      courses: [
        {
          id: 'nitt-course-cloud-engineering',
          code: 'CC 401',
          name: 'Cloud Engineering',
          level: 'Advanced',
          duration: '8 weeks',
          credits: 3,
          status: 'synthetic-demo',
        },
        {
          id: 'nitt-course-secure-coding',
          code: 'SS 320',
          name: 'Secure Software Engineering',
          level: 'Intermediate',
          duration: '8 weeks',
          credits: 3,
          status: 'synthetic-demo',
        },
      ],
      certifications: [
        {
          id: 'nitt-cert-cloud-infrastructure',
          name: 'Cloud Infrastructure Associate',
          level: 'Professional Certificate',
          assessment: 'Lab portfolio',
          status: 'synthetic-demo',
        },
        {
          id: 'nitt-cert-secure-coding',
          name: 'Secure Coding Practitioner',
          level: 'Certificate',
          assessment: 'Code review + quiz',
          status: 'synthetic-demo',
        },
      ],
      learners: [
        {
          id: 'learner-vikram-menon',
          displayName: 'Vikram Menon',
          walletAddress: '0x2000000000000000000000000000000000000002',
          credentials: [
            {
              id: 'nitt-vikram-cloud-engineering',
              skillName: 'Cloud Engineering',
              skillLevel: 'Advanced',
              issueDate: '2026-08-04',
              marks: { scored: 88, maximum: 100, grade: 'A' },
              learnerAddress: '0x2000000000000000000000000000000000000002',
              status: 'synthetic-demo',
            },
            {
              id: 'nitt-vikram-secure-coding',
              skillName: 'Secure Coding Practices',
              skillLevel: 'Proficient',
              issueDate: '2026-06-19',
              marks: { scored: 82, maximum: 100, grade: 'A-' },
              learnerAddress: '0x2000000000000000000000000000000000000002',
              status: 'synthetic-demo',
            },
          ],
        },
      ],
    },
    {
      id: 'iiit-kottayam-demo',
      name: 'Indian Institute of Information Technology Kottayam',
      shortName: 'IIIT Kottayam',
      category: 'IIIT',
      city: 'Kottayam',
      website: 'https://www.iiitkottayam.ac.in',
      status: 'synthetic-demo',
      courses: [
        {
          id: 'iiitk-course-network-security',
          code: 'CYS 301',
          name: 'Network Security Lab',
          level: 'Advanced',
          duration: '10 weeks',
          credits: 4,
          status: 'synthetic-demo',
        },
        {
          id: 'iiitk-course-ai-data-science',
          code: 'AID 402',
          name: 'AI for Data Products',
          level: 'Intermediate',
          duration: '8 weeks',
          credits: 3,
          status: 'synthetic-demo',
        },
      ],
      certifications: [
        {
          id: 'iiitk-cert-cybersecurity-foundations',
          name: 'Cybersecurity Foundations',
          level: 'Certificate',
          assessment: 'Practical lab',
          status: 'synthetic-demo',
        },
        {
          id: 'iiitk-cert-applied-data-science',
          name: 'Applied Data Science',
          level: 'Professional Certificate',
          assessment: 'Capstone project',
          status: 'synthetic-demo',
        },
      ],
      learners: [
        {
          id: 'learner-nikhil-nair',
          displayName: 'Nikhil Nair',
          walletAddress: '0x3000000000000000000000000000000000000003',
          credentials: [
            {
              id: 'iiitk-nikhil-cyber-security',
              skillName: 'Cyber Security Foundations',
              skillLevel: 'Advanced',
              issueDate: '2026-08-16',
              marks: { scored: 92, maximum: 100, grade: 'A+' },
              learnerAddress: '0x3000000000000000000000000000000000000003',
              status: 'synthetic-demo',
            },
            {
              id: 'iiitk-nikhil-ai-data-science',
              skillName: 'AI and Data Science',
              skillLevel: 'Proficient',
              issueDate: '2026-07-02',
              marks: { scored: 87, maximum: 100, grade: 'A' },
              learnerAddress: '0x3000000000000000000000000000000000000003',
              status: 'synthetic-demo',
            },
          ],
        },
      ],
    },
    {
      id: 'nit-calicut-demo',
      name: 'National Institute of Technology Calicut',
      shortName: 'NIT Calicut',
      category: 'NIT',
      city: 'Kozhikode',
      website: 'https://nitc.ac.in',
      status: 'synthetic-demo',
      courses: [
        {
          id: 'nitc-course-data-engineering',
          code: 'CSE 412',
          name: 'Data Engineering with Python',
          level: 'Intermediate',
          duration: '8 weeks',
          credits: 3,
          status: 'synthetic-demo',
        },
        {
          id: 'nitc-course-edge-networks',
          code: 'ECE 451',
          name: 'Computer Networks and Edge Systems',
          level: 'Advanced',
          duration: '10 weeks',
          credits: 4,
          status: 'synthetic-demo',
        },
      ],
      certifications: [
        {
          id: 'nitc-cert-applied-computing',
          name: 'Applied Computing Certificate',
          level: 'Certificate',
          assessment: 'Portfolio review',
          status: 'synthetic-demo',
        },
        {
          id: 'nitc-cert-edge-systems',
          name: 'Edge Systems Practitioner',
          level: 'Professional Certificate',
          assessment: 'Lab + design review',
          status: 'synthetic-demo',
        },
      ],
      learners: [
        {
          id: 'learner-meera-nair',
          displayName: 'Meera Nair',
          walletAddress: '0x4000000000000000000000000000000000000004',
          credentials: [
            {
              id: 'nitc-meera-data-engineering',
              skillName: 'Data Engineering with Python',
              skillLevel: 'Proficient',
              issueDate: '2026-08-21',
              marks: { scored: 89, maximum: 100, grade: 'A' },
              learnerAddress: '0x4000000000000000000000000000000000000004',
              status: 'synthetic-demo',
            },
            {
              id: 'nitc-meera-edge-systems',
              skillName: 'Computer Networks and Edge Systems',
              skillLevel: 'Advanced',
              issueDate: '2026-07-14',
              marks: { scored: 84, maximum: 100, grade: 'A-' },
              learnerAddress: '0x4000000000000000000000000000000000000004',
              status: 'synthetic-demo',
            },
          ],
        },
      ],
    },
    {
      id: 'iit-palakkad-demo',
      name: 'Indian Institute of Technology Palakkad',
      shortName: 'IIT Palakkad',
      category: 'IIT',
      city: 'Palakkad',
      website: 'https://iitpkd.ac.in',
      status: 'synthetic-demo',
      courses: [
        {
          id: 'iitpkd-course-robotics',
          code: 'ME 521',
          name: 'Robotics and Autonomous Systems',
          level: 'Advanced',
          duration: '12 weeks',
          credits: 4,
          status: 'synthetic-demo',
        },
        {
          id: 'iitpkd-course-ml-engineering',
          code: 'AI 410',
          name: 'Machine Learning Engineering',
          level: 'Advanced',
          duration: '10 weeks',
          credits: 4,
          status: 'synthetic-demo',
        },
      ],
      certifications: [
        {
          id: 'iitpkd-cert-intelligent-systems',
          name: 'Intelligent Systems Certificate',
          level: 'Advanced Certificate',
          assessment: 'Capstone + viva',
          status: 'synthetic-demo',
        },
        {
          id: 'iitpkd-cert-engineering-design',
          name: 'Engineering Design Studio',
          level: 'Professional Certificate',
          assessment: 'Prototype demonstration',
          status: 'synthetic-demo',
        },
      ],
      learners: [
        {
          id: 'learner-arjun-menon',
          displayName: 'Arjun Menon',
          walletAddress: '0x5000000000000000000000000000000000000005',
          credentials: [
            {
              id: 'iitpkd-arjun-robotics',
              skillName: 'Robotics and Autonomous Systems',
              skillLevel: 'Advanced',
              issueDate: '2026-08-25',
              marks: { scored: 94, maximum: 100, grade: 'A+' },
              learnerAddress: '0x5000000000000000000000000000000000000005',
              status: 'synthetic-demo',
            },
            {
              id: 'iitpkd-arjun-ml-engineering',
              skillName: 'Machine Learning Engineering',
              skillLevel: 'Advanced',
              issueDate: '2026-07-31',
              marks: { scored: 90, maximum: 100, grade: 'A+' },
              learnerAddress: '0x5000000000000000000000000000000000000005',
              status: 'synthetic-demo',
            },
          ],
        },
      ],
    },
  ] satisfies DemoOrganization[],
};

export type DemoCatalog = typeof demoCatalog;
