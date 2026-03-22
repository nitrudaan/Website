-- Test applicants for induction testing
-- Run this to add sample applicants to the database

BEGIN;

-- Insert 4 test applicants with varied profiles
INSERT INTO applicants (
  name,
  email,
  phone,
  roll_no,
  department,
  year,
  interests,
  experience,
  why_join,
  status,
  created_at
)
VALUES 
  -- Test Applicant 1: First year, Drone enthusiast
  (
    'Arjun Mehta',
    'arjun.mehta@test.com',
    '9876543210',
    '22CS101',
    'Computer Science Engineering',
    '1',
    '["Drone", "Creative/Web-Dev"]'::jsonb,
    'Built a basic quadcopter in high school. Participated in robotics club activities. Familiar with Arduino and basic electronics.',
    'I have always been fascinated by UAVs and their applications. UDAAN seems like the perfect platform to learn advanced drone technology and contribute to innovative projects. I also enjoy creative work and would love to help with media and web development.',
    'pending',
    now() - interval '2 days'
  ),
  
  -- Test Applicant 2: Second year, Rocketry focused
  (
    'Priya Sharma',
    'priya.sharma@test.com',
    '9123456789',
    '21ME045',
    'Mechanical Engineering',
    '2',
    '["Rocketry", "RC Plane"]'::jsonb,
    'Completed a course on aerospace engineering fundamentals. Member of college science club. Worked on small rocket propulsion models.',
    'Rocketry has been my passion since childhood. I want to gain hands-on experience in designing and launching rockets. UDAAN''s reputation in aerospace competitions makes it the ideal place to develop my skills and work on real projects.',
    'pending',
    now() - interval '5 days'
  ),
  
  -- Test Applicant 3: First year, RC Plane interest
  (
    'Rahul Verma',
    'rahul.verma@test.com',
    '9988776655',
    '22EE078',
    'Electrical Engineering',
    '1',
    '["RC Plane", "Drone"]'::jsonb,
    'Built several RC model airplanes. Good understanding of aerodynamics and flight controls. Experience with radio control systems and basic circuit design.',
    'Flying RC planes has been my hobby for years. I want to take it to the next level by working on advanced aerodynamic designs and autonomous flight systems. UDAAN provides the perfect environment to collaborate with like-minded individuals.',
    'pending',
    now() - interval '1 day'
  ),
  
  -- Test Applicant 4: Second year, Creative/Web development
  (
    'Sneha Patel',
    'sneha.patel@test.com',
    '9234567890',
    '21CS112',
    'Computer Science Engineering',
    '2',
    '["Creative/Web-Dev", "Management"]'::jsonb,
    'Proficient in React, TypeScript, and modern web technologies. Created websites for college fests. Experience in graphic design using Figma and Adobe tools. Social media management for student clubs.',
    'I am passionate about creating engaging digital experiences and visual content. I would love to contribute to UDAAN''s online presence and help showcase the amazing work you do. I also have interest in event management and coordination.',
    'pending',
    now() - interval '3 days'
  )
ON CONFLICT DO NOTHING;

COMMIT;

-- Query to verify the test applicants were added
SELECT 
  name, 
  email, 
  roll_no, 
  department, 
  year, 
  interests, 
  status,
  created_at
FROM applicants 
WHERE email LIKE '%@test.com'
ORDER BY created_at DESC;
